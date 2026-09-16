// import { Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import Swal from 'sweetalert2';
// import {
//   AutoPlanApiService,
//   Documento as ApiDocumento,
//   Vehiculo as ApiVehiculo,
//   Taller as ApiTaller
// } from '../../services/auto-plan-api.service';

// export type Documento = ApiDocumento;
// export type Vehiculo = ApiVehiculo;
// export type Taller = ApiTaller;


import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import { ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import {
  AutoPlanApiService,
  Documento as ApiDocumento,
  Vehiculo as ApiVehiculo,
  Taller as ApiTaller,
  Mantenimiento as ApiMantenimiento
} from '../../services/auto-plan-api.service';

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export type Documento = ApiDocumento;
export type Vehiculo = ApiVehiculo;
export type Taller = ApiTaller;
export type Mantenimiento = ApiMantenimiento;

interface DocStatus {
  level: 'green' | 'amber' | 'red' | 'gray';
  text: string;
}

type DocumentPhotoField = 'foto' | 'fotoFrente' | 'fotoAtras';

const DOC_TYPES: { key: string; label: string }[] = [
  {
    key: 'permisoCirculacion',
    label: 'Permiso de circulación'
  },
  {
    key: 'seguro',
    label: 'Seguro'
  },
  {
    key: 'revisionTecnica',
    label: 'Revisión técnica'
  },
  {
    key: 'padron',
    label: 'Padrón'
  },
  {
    key: 'licenciaConducir',
    label: 'Licencia de conducir'
  }
];

const STORAGE_VEHICULOS = 'autoplan.vehiculos';
const STORAGE_TALLERES = 'autoplan.talleres';

type ModalState =
  | {
      type: 'mantenimiento';
      patente: string;
      editingId: string | null;
      data: Partial<Mantenimiento>;
    }
  | {
      type: 'vehicle';
      editingPatente: string | null;
      data: Partial<Vehiculo>;
    }
  | {
      type: 'doc';
      patente: string;
      docKey: string;
      data: Partial<Documento>;
    }
  | {
      type: 'taller';
      editingIndex: number | null;
      data: Partial<Taller>;
    }
  | null;

@Component({
  selector: 'app-mis-vehiculos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mis-vehiculos.component.html',
  styleUrls: ['./mis-vehiculos.component.css']
})
export class MisVehiculosComponent implements OnInit {

  readonly docTypes = DOC_TYPES;

  tab: 'vehiculos' | 'talleres' | 'mantenimiento' = 'vehiculos';

  vehiculos: Vehiculo[] = [];

  talleres: Taller[] = [];

  selectedPatente: string | null = null;

  modal: ModalState = null;

  fieldError: string | null = null;

  isSavingVehicle = false;

  isSavingDocument = false;

  isSavingTaller = false;

  documentPreviewUrl: string | null = null;

  safeDocumentPreviewUrl: SafeResourceUrl | null = null;

  documentPreviewName: string = '';

  documentPhotoField: DocumentPhotoField = 'foto';

  constructor(
    private api: AutoPlanApiService,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('action') === 'add') {
        this.openVehicleModal();
      }
    });

    this.loadFromApi();
  }

  private loadFromApi(): void {
    this.api.getVehiculos().subscribe({
      next: (vehicles) => {
        this.vehiculos = this.sortVehiculosByPatente(vehicles.length ? vehicles : this.readStorage<Vehiculo[]>(STORAGE_VEHICULOS, []));
        if (this.vehiculos.length > 0) {
          this.selectedPatente = this.vehiculos[0].patente;
        }
        void this.generateMissingPdfThumbnails();
      },
      error: () => {
        this.vehiculos = this.sortVehiculosByPatente(this.readStorage<Vehiculo[]>(STORAGE_VEHICULOS, []));
        if (this.vehiculos.length > 0) {
          this.selectedPatente = this.vehiculos[0].patente;
        }
        void this.generateMissingPdfThumbnails();
      }
    });

    this.api.getTalleres().subscribe({
      next: (shops) => {
        this.talleres = this.sortTalleresByNombre(shops.length ? shops : this.readStorage<Taller[]>(STORAGE_TALLERES, []));
      },
      error: () => {
        this.talleres = this.sortTalleresByNombre(this.readStorage<Taller[]>(STORAGE_TALLERES, []));
      }
    });
  }

  private sortVehiculosByPatente(vehiculos: Vehiculo[]): Vehiculo[] {
    return [...vehiculos].sort((a, b) =>
      a.patente.localeCompare(b.patente, 'es', { numeric: true })
    );
  }

  private sortTalleresByNombre(talleres: Taller[]): Taller[] {
    return [...talleres].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );
  }

  private normalizePatente(patente: string): string {
    return patente.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  }

  private isValidPatente(patente: string): boolean {
    return /^(?:[A-Z]{2}[0-9]{4}|[A-Z]{4}[0-9]{2}|[A-Z]{2}[0-9]{2}[A-Z0-9]{2})$/.test(patente);
  }

  private isStorageAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  private readStorage<T>(key: string, fallback: T): T {
    if (!this.isStorageAvailable()) {
      return fallback;
    }

    try {
      const raw = localStorage.getItem(key);

      if (raw) {
        const parsed = JSON.parse(raw) as T;

        return parsed ?? fallback;
      }

      return fallback;
    } catch {
      return fallback;
    }
  }

  private stripOversizedDocumentPhotos(vehicles: Vehiculo[]): Vehiculo[] {
    return vehicles.map((vehicle) => {
      if (!vehicle.documentos) {
        return vehicle;
      }

      const documentos: Record<string, Documento> = {};

      Object.entries(vehicle.documentos).forEach(([key, doc]) => {
        const cleaned: Documento = { ...doc };

        if (typeof cleaned.foto === 'string' && cleaned.foto.length > 240000) {
          cleaned.foto = '';
          cleaned.digitalizado = Boolean(cleaned.archivo || cleaned.numero || cleaned.vencimiento || cleaned.notas);
        }

        if (typeof cleaned.miniatura === 'string' && cleaned.miniatura.length > 180000) {
          cleaned.miniatura = '';
        }

        if (typeof cleaned.fotoFrente === 'string' && cleaned.fotoFrente.length > 240000) {
          cleaned.fotoFrente = '';
        }

        if (typeof cleaned.fotoAtras === 'string' && cleaned.fotoAtras.length > 240000) {
          cleaned.fotoAtras = '';
        }

        if (typeof cleaned.archivo === 'string' && cleaned.archivo.length > 200 && !cleaned.foto) {
          cleaned.archivo = '';
          cleaned.digitalizado = Boolean(cleaned.numero || cleaned.vencimiento || cleaned.notas);
        }

        documentos[key] = cleaned;
      });

      return {
        ...vehicle,
        documentos
      };
    });
  }

  private compactVehiclesForStorage(vehicles: Vehiculo[]): Vehiculo[] {
    let compacted = this.stripOversizedDocumentPhotos(vehicles);

    for (let pass = 0; pass < 4; pass++) {
      const serialized = JSON.stringify(compacted);

      if (serialized.length <= 1500000) {
        return compacted;
      }

      compacted = compacted.map((vehicle) => {
        if (!vehicle.documentos) {
          return vehicle;
        }

        const documentos: Record<string, Documento> = {};

        Object.entries(vehicle.documentos).forEach(([key, doc]) => {
          const cleaned: Documento = { ...doc };

          cleaned.foto = '';
          cleaned.miniatura = '';
          cleaned.fotoFrente = '';
          cleaned.fotoAtras = '';
          cleaned.archivo = '';
          cleaned.digitalizado = Boolean(cleaned.numero || cleaned.vencimiento || cleaned.notas || cleaned.digitalizado);

          documentos[key] = cleaned;
        });

        return {
          ...vehicle,
          documentos
        };
      });
    }

    return compacted;
  }

  private saveVehiculos(onComplete?: () => void): boolean {
    if (this.isSavingVehicle) {
      return false;
    }

    this.isSavingVehicle = true;

    const payload = this.compactVehiclesForStorage(this.vehiculos);
    const persistLocally = () => {
      if (!this.isStorageAvailable()) {
        return;
      }

      try {
        localStorage.setItem(STORAGE_VEHICULOS, JSON.stringify(payload));
        this.vehiculos = this.sortVehiculosByPatente(payload);
      } catch {
        this.notifyError(
          'No se pudo guardar el vehículo',
          'La imagen o la cantidad de datos supera el límite del navegador. Reduce el tamaño o quita archivos grandes.'
        );
      }
    };

    try {
      this.api.saveVehiculos(payload).subscribe({
        next: (response) => {
          const savedVehicles = Array.isArray(response?.data) ? response.data : payload;
          this.vehiculos = this.sortVehiculosByPatente(savedVehicles);
          if (this.isStorageAvailable()) {
            localStorage.setItem(STORAGE_VEHICULOS, JSON.stringify(savedVehicles));
          }
          this.notifySuccess('Vehículo guardado', 'Los cambios se guardaron correctamente.');
          this.isSavingVehicle = false;
          onComplete?.();
        },
        error: () => {
          persistLocally();
          this.notifyError(
            'No se pudo guardar el vehículo',
            'La conexión con la base de datos falló y se guardó solo en el navegador.'
          );
          this.isSavingVehicle = false;
          onComplete?.();
        }
      });

      persistLocally();
      return true;
    } catch (error) {
      this.isSavingVehicle = false;
      if (this.isStorageAvailable()) {
        try {
          const fallback = this.compactVehiclesForStorage(payload);
          localStorage.setItem(STORAGE_VEHICULOS, JSON.stringify(fallback));
          this.vehiculos = this.sortVehiculosByPatente(fallback);
          this.notifyError(
            'Se guardó sin algunas fotos grandes',
            'Las fotos muy pesadas se descartaron para mantener el guardado del vehículo.'
          );
          return true;
        } catch (retryError) {
          this.notifyError(
            'No se pudo guardar el vehículo',
            'La imagen o la cantidad de datos supera el límite del navegador. Reduce el tamaño o quita archivos grandes.'
          );
          console.error('Error guardando vehículos:', retryError);
          return false;
        }
      }

      return false;
    }
  }

  private saveTalleres(onComplete?: () => void): void {
    try {
      this.api.saveTalleres(this.talleres).subscribe({
        next: () => {
          this.notifySuccess('Taller guardado', 'El taller quedó registrado correctamente.');
          if (this.isStorageAvailable()) {
            localStorage.setItem(STORAGE_TALLERES, JSON.stringify(this.talleres));
          }
          onComplete?.();
        },
        error: () => {
          if (this.isStorageAvailable()) {
            localStorage.setItem(STORAGE_TALLERES, JSON.stringify(this.talleres));
          }
          this.notifyError(
            'No se pudo guardar el taller',
            'La conexión con la base de datos falló y se guardó solo en el navegador.'
          );
          onComplete?.();
        }
      });

      if (this.isStorageAvailable()) {
        localStorage.setItem(STORAGE_TALLERES, JSON.stringify(this.talleres));
      }
    } catch (error) {
      this.notifyError(
        'No se pudo guardar el taller',
        'El navegador no pudo guardar esta información. Intenta quitar datos grandes o archivos adjuntos.'
      );
      onComplete?.();
      console.error('Error guardando talleres:', error);
    }
  }

  private notifySuccess(title: string, text?: string): void {
    Swal.fire({
      icon: 'success',
      title,
      text,
      timer: 1800,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  }

  private notifyError(title: string, text?: string): void {
    Swal.fire({
      icon: 'error',
      title,
      text,
      timer: 2600,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  }

  private resizeImageToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = () => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxWidth = 1400;
          const scale = Math.min(1, maxWidth / img.width);

          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));

          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('No se pudo preparar la imagen.'));
            return;
          }

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          resolve(canvas.toDataURL('image/jpeg', 0.72));
        };

        img.onerror = () => reject(new Error('La imagen no es válida.'));
        img.src = reader.result as string;
      };

      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(file);
    });
  }

  setTab(tab: 'vehiculos' | 'talleres'| 'mantenimiento'): void {
    this.tab = tab;
  }

  get selectedVehicle(): Vehiculo | undefined {
    return this.vehiculos.find(
      (v) => v.patente === this.selectedPatente
    );
  }

  selectVehicle(patente: string): void {
    this.selectedPatente = patente;
  }

  docStatus(doc: Documento | undefined): DocStatus {

    if (!doc || !doc.vencimiento) {
      return {
        level: 'gray',
        text: 'Sin fecha registrada'
      };
    }

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const venc = new Date(
      doc.vencimiento + 'T00:00:00'
    );

    const diff = Math.round(
      (venc.getTime() - today.getTime()) / 86400000
    );

    if (diff < 0) {
      return {
        level: 'red',
        text:
          'Vencido hace ' +
          Math.abs(diff) +
          ' día' +
          (Math.abs(diff) === 1 ? '' : 's')
      };
    }

    if (diff === 0) {
      return {
        level: 'amber',
        text: 'Vence hoy'
      };
    }

    if (diff <= 30) {
      return {
        level: 'amber',
        text:
          'Vence en ' +
          diff +
          ' día' +
          (diff === 1 ? '' : 's')
      };
    }

    return {
      level: 'green',
      text: 'Vigente'
    };
  }

  worstStatus(v: Vehiculo): DocStatus['level'] {

    const levels = this.docTypes.map(
      (dt) =>
        this.docStatus(
          v.documentos?.[dt.key]
        ).level
    );

    if (levels.includes('red')) {
      return 'red';
    }

    if (levels.includes('amber')) {
      return 'amber';
    }

    if (levels.every((level) => level === 'gray')) {
      return 'gray';
    }

    return 'green';
  }

  fmtDate(d: string | undefined): string {

    if (!d) {
      return '—';
    }

    const parts = d.split('-');

    if (parts.length !== 3) {
      return d;
    }

    const y = parts[0];
    const m = parts[1];
    const day = parts[2];

    return day + '/' + m + '/' + y;
  }

  docLabel(key: string): string {

    const doc = this.docTypes.find(
      (dt) => dt.key === key
    );

    return doc ? doc.label : '';
  }

  // ==========================================
  // VEHÍCULOS
  // ==========================================

  openVehicleModal(patente?: string): void {

    const v = patente
      ? this.vehiculos.find(
          (x) => x.patente === patente
        )
      : null;

    this.fieldError = null;

    this.modal = {
      type: 'vehicle',

      editingPatente:
        patente ?? null,

      data: v
        ? { ...v }
        : {
            patente: '',
            marca: '',
            modelo: '',
            anio: '',
            color: '',
            documentos: {}
          }
    };
  }

 submitVehicleForm(): void {

    if (this.modal?.type !== 'vehicle' || this.isSavingVehicle) {
      return;
    }

    const data = this.modal.data;

    const patente = this.normalizePatente(
      data.patente || ''
    );

    if (!patente) {
      this.fieldError =
        'Ingresa la patente';

      return;
    }

    if (!this.isValidPatente(patente)) {
      this.fieldError =
        'La patente debe tener un formato válido, por ejemplo: AB-1234 o ABCD12';

      return;
    }

    const editing =
      this.modal.editingPatente;

    const dup =
      this.vehiculos.find(
        (v) =>
          v.patente === patente &&
          v.patente !== editing
      );

    if (dup) {
      this.fieldError =
        'Ya existe un vehículo con esa patente';

      return;
    }

    const nuevo: Vehiculo = {

      patente,

      marca:
        (data.marca || '').trim(),

      modelo:
        (data.modelo || '').trim(),

      anio:
        (data.anio || '').trim(),

      color:
        (data.color || '').trim(),

      documentos: {}
    };

    if (editing) {

      const idx =
        this.vehiculos.findIndex(
          (v) =>
            v.patente === editing
        );

      if (idx !== -1) {

        nuevo.documentos =
          this.vehiculos[idx].documentos || {};

        this.vehiculos[idx] = nuevo;
      }

    } else {

      this.vehiculos.push(nuevo);
    }

    this.vehiculos = this.sortVehiculosByPatente(this.vehiculos);
    this.selectedPatente = patente;

    this.modal = null;

    this.saveVehiculos();
  }

  deleteVehicle(patente: string): void {

    const confirmar = confirm(
      '¿Eliminar el vehículo ' +
      patente +
      ' y todos sus documentos guardados?'
    );

    if (!confirmar) {
      return;
    }

    this.vehiculos =
      this.vehiculos.filter(
        (v) =>
          v.patente !== patente
      );

    if (
      this.selectedPatente === patente
    ) {

      this.selectedPatente =
        this.vehiculos.length > 0
          ? this.vehiculos[0].patente
          : null;
    }

    this.saveVehiculos();
  }

  // ==========================================
  // DOCUMENTOS
  // ==========================================

  isPdfDataUrl(value?: string): boolean {
    return !!value && value.startsWith('data:application/pdf');
  }

  openDocumentPreview(doc: Documento | undefined, photoField: DocumentPhotoField = 'foto'): void {
    const photo = doc?.[photoField];

    if (!photo) {
      return;
    }

    this.documentPhotoField = photoField;
    this.documentPreviewUrl = photo;
    this.documentPreviewName = doc.archivo || 'Documento';
    this.safeDocumentPreviewUrl = this.isPdfDataUrl(photo)
      ? this.sanitizer.bypassSecurityTrustResourceUrl(photo)
      : null;
  }

  closeDocumentPreview(): void {
    this.documentPreviewUrl = null;
    this.documentPreviewName = '';
    this.safeDocumentPreviewUrl = null;
  }

  openFilePicker(input: HTMLInputElement): void {
    const pickerInput = input as HTMLInputElement & {
      showPicker?: () => void;
    };

    if (pickerInput.showPicker) {
      pickerInput.showPicker();
      return;
    }

    input.click();
  }

  async onDocPhotoSelected(event: Event, photoField: DocumentPhotoField = 'foto'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf && !file.type.startsWith('image/')) {
      this.fieldError = 'Solo se permiten imágenes o archivos PDF.';
      return;
    }

    if (isPdf && file.size > 700 * 1024) {
      this.fieldError = 'El PDF es demasiado grande. Sube uno de hasta 700 KB.';
      return;
    }

    if (!isPdf && file.size > 2 * 1024 * 1024) {
      this.fieldError = 'La foto es demasiado grande. Sube una imagen de hasta 2 MB.';
      return;
    }

    try {
      let result = '';

      if (isPdf) {
        const pdfReader = new FileReader();
        const pdfResult = await new Promise<string>((resolve, reject) => {
          pdfReader.onload = () => resolve(pdfReader.result as string);
          pdfReader.onerror = () => reject(new Error('No se pudo leer el PDF.'));
          pdfReader.readAsDataURL(file);
        });

        result = pdfResult;
        const thumbnail = await this.createPdfThumbnail(result);

        if (this.modal?.type === 'doc') {
          this.modal.data.miniatura = thumbnail;
        }
      } else {
        result = await this.resizeImageToDataUrl(file);
        if (this.modal?.type === 'doc') {
          this.modal.data.miniatura = '';
        }
      }

      if (this.modal?.type === 'doc') {
        this.modal.data[photoField] = result;
        this.modal.data.digitalizado = true;
        this.modal.data.archivo = file.name || this.modal.data.archivo || 'documento.pdf';
        this.fieldError = null;
        input.value = '';
      }
    } catch (error) {
      this.fieldError = 'No se pudo procesar el archivo. Intenta con otra imagen o PDF más liviano.';
      console.error('Error leyendo documento:', error);
    }
  }

  private async createPdfThumbnail(dataUrl: string): Promise<string> {
    const base64 = dataUrl.split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }

    const pdf = await getDocument({ data: bytes }).promise;
    const page = await pdf.getPage(1);
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(320 / unscaledViewport.width, 180 / unscaledViewport.height);
    const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');

    if (!context) {
      return '';
    }

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.78);
  }

  private async generateMissingPdfThumbnails(): Promise<void> {
    let changed = false;

    for (const vehicle of this.vehiculos) {
      for (const document of Object.values(vehicle.documentos || {})) {
        if (!document.foto || !this.isPdfDataUrl(document.foto) || document.miniatura) {
          continue;
        }

        try {
          document.miniatura = await this.createPdfThumbnail(document.foto);
          changed = Boolean(document.miniatura) || changed;
        } catch (error) {
          console.error('No se pudo generar la miniatura del PDF:', error);
        }
      }
    }

    if (!changed) {
      return;
    }

    const payload = this.compactVehiclesForStorage(this.vehiculos);
    this.api.saveVehiculos(payload).subscribe({
      next: () => {
        if (this.isStorageAvailable()) {
          localStorage.setItem(STORAGE_VEHICULOS, JSON.stringify(payload));
        }
      },
      error: (error) => console.error('No se pudieron guardar las miniaturas PDF:', error)
    });
  }

  openDocModal(
    patente: string,
    docKey: string
  ): void {

    const v =
      this.vehiculos.find(
        (x) =>
          x.patente === patente
      );

    const doc =
      v?.documentos?.[docKey] ?? {
        numero: '',
        vencimiento: '',
        notas: '',
        digitalizado: false,
        archivo: '',
        foto: '',
        miniatura: '',
        fotoFrente: '',
        fotoAtras: ''
      };

    this.fieldError = null;

    this.modal = {
      type: 'doc',

      patente,

      docKey,

      data: {
        ...doc
      }
    };
  }

  submitDocForm(): void {

    if (this.modal?.type !== 'doc' || this.isSavingDocument) {
      return;
    }

    this.isSavingDocument = true;

    const patente =
      this.modal.patente;

    const docKey =
      this.modal.docKey;

    const data =
      this.modal.data;

    const v =
      this.vehiculos.find(
        (x) =>
          x.patente === patente
      );

    if (!v) {
      this.isSavingDocument = false;
      return;
    }

    if (!v.documentos) {
      v.documentos = {};
    }

    const digitalizado = Boolean(
      data.digitalizado ||
      (data.archivo || '').trim() ||
      (data.foto || '').trim() ||
      (data.fotoFrente || '').trim() ||
      (data.fotoAtras || '').trim()
    );

    v.documentos[docKey] = {

      numero:
        (data.numero || '').trim(),

      vencimiento:
        data.vencimiento || '',

      notas:
        (data.notas || '').trim(),

      digitalizado,

      archivo:
        (data.archivo || '').trim(),

      foto:
        (data.foto || '').trim(),

      miniatura:
        (data.miniatura || '').trim(),

      fotoFrente:
        (data.fotoFrente || '').trim(),

      fotoAtras:
        (data.fotoAtras || '').trim()
    };

    this.modal = null;

    this.saveVehiculos(() => {
      this.isSavingDocument = false;
    });
  }

  // ==========================================
  // TALLERES
  // ==========================================

  openTallerModal(index?: number): void {

    const t =
      index !== undefined
        ? this.talleres[index]
        : null;

    this.fieldError = null;

    this.modal = {

      type: 'taller',

      editingIndex:
        index !== undefined
          ? index
          : null,

      data: t
        ? { ...t }
        : {
            nombre: '',
            direccion: '',
            telefono: '',
            especialidad: '',
            notas: ''
          }
    };
  }

  submitTallerForm(): void {

    if (this.modal?.type !== 'taller' || this.isSavingTaller) {
      return;
    }

    this.isSavingTaller = true;

    const data =
      this.modal.data;

    const nombre =
      (data.nombre || '').trim();

    if (!nombre) {

      this.fieldError =
        'Ingresa el nombre del taller';
      this.isSavingTaller = false;

      return;
    }

    const nuevo: Taller = {

      nombre,

      direccion:
        (data.direccion || '').trim(),

      telefono:
        (data.telefono || '').trim(),

      especialidad:
        (data.especialidad || '').trim(),

      notas:
        (data.notas || '').trim()
    };

    const idx =
      this.modal.editingIndex;

    if (idx !== null) {

      this.talleres[idx] = nuevo;

    } else {

      this.talleres.push(nuevo);
    }

    this.talleres = this.sortTalleresByNombre(this.talleres);
    this.modal = null;

    this.saveTalleres(() => {
      this.isSavingTaller = false;
    });
  }

  deleteTaller(index: number): void {

    const confirmar = confirm(
      '¿Eliminar este taller?'
    );

    if (!confirmar) {
      return;
    }

    this.talleres.splice(index, 1);

    this.saveTalleres();
  }

  closeModal(): void {

    this.modal = null;

    this.fieldError = null;
  }
  // ==========================================
  // MANTENIMIENTO
  // ==========================================

  mantenimientoStatus(v: Vehiculo, m: Mantenimiento): DocStatus {

    const kmActual = parseInt(v.kilometrajeActual || '', 10);
    const proximoKm = parseInt(m.proximoKm || '', 10);

    if (m.proximaFecha) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const venc = new Date(m.proximaFecha + 'T00:00:00');
      const diff = Math.round((venc.getTime() - today.getTime()) / 86400000);

      if (diff < 0) {
        return { level: 'red', text: 'Vencido hace ' + Math.abs(diff) + ' día' + (Math.abs(diff) === 1 ? '' : 's') };
      }
      if (diff <= 30) {
        return { level: 'amber', text: diff === 0 ? 'Vence hoy' : 'Faltan ' + diff + ' día' + (diff === 1 ? '' : 's') };
      }
    }

    if (!isNaN(kmActual) && !isNaN(proximoKm)) {
      const restante = proximoKm - kmActual;

      if (restante <= 0) {
        return { level: 'red', text: 'Superó el kilometraje (' + Math.abs(restante) + ' km de más)' };
      }
      if (restante <= 1000) {
        return { level: 'amber', text: 'Faltan ' + restante + ' km' };
      }
    }

    if (!m.proximaFecha && !m.proximoKm) {
      return { level: 'gray', text: 'Sin próximo aviso' };
    }

    return { level: 'green', text: 'Al día' };
  }

  worstMantenimientoStatus(v: Vehiculo): DocStatus['level'] {
    const registros = v.mantenimientos || [];

    if (!registros.length) {
      return 'gray';
    }

    const levels = registros.map((m) => this.mantenimientoStatus(v, m).level);

    if (levels.includes('red')) return 'red';
    if (levels.includes('amber')) return 'amber';
    if (levels.every((l) => l === 'gray')) return 'gray';
    return 'green';
  }

  sortedMantenimientos(v: Vehiculo): Mantenimiento[] {
    const registros = v.mantenimientos || [];
    return [...registros].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }

  updateKilometraje(v: Vehiculo, valor: string): void {
    v.kilometrajeActual = valor.replace(/[^0-9]/g, '');
    this.saveVehiculos();
  }

  openMantenimientoModal(patente: string, id?: string): void {
    const v = this.vehiculos.find((x) => x.patente === patente);
    const registro = id ? v?.mantenimientos?.find((m) => m.id === id) : null;

    this.fieldError = null;

    this.modal = {
      type: 'mantenimiento',
      patente,
      editingId: id ?? null,
      data: registro
        ? { ...registro }
        : {
            tipo: '',
            fecha: '',
            kilometraje: v?.kilometrajeActual || '',
            notas: '',
            proximoKm: '',
            proximaFecha: ''
          }
    };
  }

  submitMantenimientoForm(): void {
    if (this.modal?.type !== 'mantenimiento') {
      return;
    }

    const { patente, editingId, data } = this.modal;
    const tipo = (data.tipo || '').trim();

    if (!tipo) {
      this.fieldError = 'Ingresa el tipo de mantenimiento (ej: cambio de aceite)';
      return;
    }

    const v = this.vehiculos.find((x) => x.patente === patente);
    if (!v) {
      return;
    }

    if (!v.mantenimientos) {
      v.mantenimientos = [];
    }

    const nuevo: Mantenimiento = {
      id: editingId || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
      tipo,
      fecha: data.fecha || '',
      kilometraje: (data.kilometraje || '').trim(),
      notas: (data.notas || '').trim(),
      proximoKm: (data.proximoKm || '').trim(),
      proximaFecha: data.proximaFecha || ''
    };

    if (editingId) {
      const idx = v.mantenimientos.findIndex((m) => m.id === editingId);
      if (idx !== -1) {
        v.mantenimientos[idx] = nuevo;
      }
    } else {
      v.mantenimientos.push(nuevo);
    }

    this.modal = null;
    this.saveVehiculos();
  }

  deleteMantenimiento(patente: string, id: string): void {
    const confirmar = confirm('¿Eliminar este registro de mantenimiento?');
    if (!confirmar) {
      return;
    }

    const v = this.vehiculos.find((x) => x.patente === patente);
    if (!v?.mantenimientos) {
      return;
    }

    v.mantenimientos = v.mantenimientos.filter((m) => m.id !== id);
    this.saveVehiculos();
  }
}