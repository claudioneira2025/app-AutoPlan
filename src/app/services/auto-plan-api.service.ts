import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Documento {
  numero: string;
  vencimiento: string;
  notas: string;
  digitalizado?: boolean;
  archivo?: string;
  foto?: string;
  miniatura?: string;
  fotoFrente?: string;
  fotoAtras?: string;
}

export interface Mantenimiento {
  id: string;
  tipo: string;
  fecha: string;
  kilometraje: string;
  notas: string;
  proximoKm: string;
  proximaFecha: string;
}

export interface Vehiculo {
  id?: string;
  patente: string;
  marca: string;
  modelo: string;
  anio: string;
  color: string;
  kilometrajeActual?: string;
  documentos?: Record<string, Documento>;
  mantenimientos?: Mantenimiento[];
}

export interface Taller {
  id?: string;
  nombre: string;
  direccion: string;
  telefono: string;
  especialidad: string;
  notas: string;
}

@Injectable({ providedIn: 'root' })
export class AutoPlanApiService {
  constructor(private http: HttpClient) {}

  getVehiculos(): Observable<Vehiculo[]> {
    return this.http.get<Vehiculo[]>('/api/vehiculos');
  }

  saveVehiculos(vehiculos: Vehiculo[]): Observable<any> {
    return this.http.post('/api/vehiculos', vehiculos);
  }

  deleteVehiculo(patente: string): Observable<any> {
    return this.http.delete(`/api/vehiculos/${encodeURIComponent(patente)}`);
  }

  getTalleres(): Observable<Taller[]> {
    return this.http.get<Taller[]>('/api/talleres');
  }

  saveTalleres(talleres: Taller[]): Observable<any> {
    return this.http.post('/api/talleres', talleres);
  }

  deleteTaller(nombre: string): Observable<any> {
    return this.http.delete(`/api/talleres/${encodeURIComponent(nombre)}`);
  }
}