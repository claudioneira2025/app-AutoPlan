
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router'; 

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule], // <-- Módulos para navegación y condiciones del HTML
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  
 
  constructor(private router: Router) {}

  irAMisVehiculos(): void {
    void this.router.navigate(['/vehiculos']);
  }

  irAAgregarVehiculo(event: MouseEvent): void {
    event.preventDefault();
    void this.router.navigate(['/vehiculos'], {
      queryParams: { action: 'add', request: Date.now() }
    });
  }

  estaEnVehiculos(): boolean {
    return this.router.url === '/vehiculos';
  }

  estaEnLogin(): boolean {
    return this.router.url === '/';
  }

  // Esta es la función que ejecuta tu botón al hacer clic
  cerrarSesion() {
    // BORRAMOS EL ESTADO DE LA SESIÓN AL SALIR
    localStorage.removeItem('isLoggedIn');

    // Redirige al usuario de vuelta a la pantalla de login (ruta raíz)
    this.router.navigate(['/']);
  }
}
