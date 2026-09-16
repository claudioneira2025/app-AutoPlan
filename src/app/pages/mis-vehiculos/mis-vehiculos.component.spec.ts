import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { MisVehiculosComponent } from './mis-vehiculos.component';

describe('MisVehiculosComponent', () => {
  let component: MisVehiculosComponent;
  let fixture: ComponentFixture<MisVehiculosComponent>;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [MisVehiculosComponent, HttpClientTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MisVehiculosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not crash when storage throws while saving a vehicle', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('QuotaExceededError');

    component.modal = {
      type: 'vehicle',
      editingPatente: null,
      data: {
        patente: 'AB1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        anio: '2024',
        color: 'Blanco',
        documentos: {}
      }
    };

    expect(() => component.submitVehicleForm()).not.toThrow();
    expect(component.vehiculos.length).toBe(1);
    expect(component.selectedPatente).toBe('AB1234');
  });

  it('should block duplicate vehicle submits while a save is already in progress', () => {
    component.modal = {
      type: 'vehicle',
      editingPatente: null,
      data: {
        patente: 'AB1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        anio: '2024',
        color: 'Blanco',
        documentos: {}
      }
    };

    component.isSavingVehicle = true;
    const spy = spyOn(component as any, 'saveVehiculos');

    component.submitVehicleForm();

    expect(spy).not.toHaveBeenCalled();
  });

  it('should sort vehicles by patent', () => {
    component.vehiculos = [
      { patente: 'ZZ9999', marca: 'Ford', modelo: 'Focus', anio: '2020', color: 'Azul', documentos: {} },
      { patente: 'AB1234', marca: 'Toyota', modelo: 'Corolla', anio: '2023', color: 'Blanco', documentos: {} },
      { patente: 'CC4321', marca: 'Renault', modelo: 'Clio', anio: '2021', color: 'Rojo', documentos: {} }
    ];

    component.vehiculos = component['sortVehiculosByPatente'](component.vehiculos);

    expect(component.vehiculos.map(v => v.patente)).toEqual(['AB1234', 'CC4321', 'ZZ9999']);
  });

  it('should validate patent format', () => {
    expect(component['isValidPatente']('AB1234')).toBeTrue();
    expect(component['isValidPatente']('ABCD12')).toBeTrue();
    expect(component['isValidPatente']('A123')).toBeFalse();
  });

  it('should save digitalized document metadata', () => {
    component.vehiculos = [{
      patente: 'AB1234',
      marca: 'Toyota',
      modelo: 'Corolla',
      anio: '2024',
      color: 'Blanco',
      documentos: {}
    }];

    component.modal = {
      type: 'doc',
      patente: 'AB1234',
      docKey: 'seguro',
      data: {
        numero: 'SEG-104',
        vencimiento: '2027-04-12',
        notas: 'Poliza digitalizada',
        digitalizado: true,
        archivo: 'seguro-AB1234.pdf'
      }
    };

    spyOn(component['api'], 'saveVehiculos').and.returnValue(of({ data: component.vehiculos }));
    component.submitDocForm();

    expect(component.vehiculos[0].documentos?.['seguro']?.digitalizado).toBeTrue();
    expect(component.vehiculos[0].documentos?.['seguro']?.archivo).toBe('seguro-AB1234.pdf');
    expect(component.isSavingDocument).toBeFalse();
  });

  it('should strip oversized document photos before persisting vehicle data', () => {
    component.vehiculos = [{
      patente: 'AB1234',
      marca: 'Toyota',
      modelo: 'Corolla',
      anio: '2024',
      color: 'Blanco',
      documentos: {
        seguro: {
          numero: 'SEG-104',
          vencimiento: '2027-04-12',
          notas: 'Foto grande',
          digitalizado: true,
          archivo: 'seguro-AB1234.pdf',
          foto: 'A'.repeat(600000)
        }
      }
    }];

    component['saveVehiculos']();

    const saved = JSON.parse(localStorage.getItem('autoplan.vehiculos') || '[]');
    expect(saved[0].documentos.seguro.foto).toBe('');
    expect(saved[0].documentos.seguro.digitalizado).toBeTrue();
  });

  it('should strip all document photos when the combined payload exceeds browser storage limits', () => {
    component.vehiculos = Array.from({ length: 12 }, (_, index) => ({
      patente: `AB${String(index + 1).padStart(4, '0')}`,
      marca: 'Toyota',
      modelo: 'Corolla',
      anio: '2024',
      color: 'Blanco',
      documentos: {
        seguro: {
          numero: 'SEG-104',
          vencimiento: '2027-04-12',
          notas: 'Foto grande',
          digitalizado: true,
          archivo: 'seguro.pdf',
          foto: 'A'.repeat(180000)
        }
      }
    }));

    const result = component['saveVehiculos']();

    expect(result).toBeTrue();

    const saved = JSON.parse(localStorage.getItem('autoplan.vehiculos') || '[]');
    expect(saved.every((vehicle: any) => !vehicle.documentos?.seguro?.foto)).toBeTrue();
  });
});
