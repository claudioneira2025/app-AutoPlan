import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  
  // Verificamos si la sesión existe en el almacenamiento del navegador
  const sesionActiva = localStorage.getItem('isLoggedIn');

  if (sesionActiva === 'true') {
    return true; // Permite el acceso a la pantalla
  }

  // Si no está logueado, lo redirige al login y bloquea la ruta
  router.navigate(['/']);
  return false;
};