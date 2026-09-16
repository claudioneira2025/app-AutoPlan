import { Routes } from '@angular/router';
import { InicioComponent } from './pages/inicio/inicio.component';
import { MisVehiculosComponent } from './pages/mis-vehiculos/mis-vehiculos.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: InicioComponent },
  { path: 'vehiculos', component: MisVehiculosComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
