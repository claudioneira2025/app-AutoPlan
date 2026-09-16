import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css'
})
export class InicioComponent {
  usuario = '';
  password = '';
  error = '';

  constructor(private router: Router) {}

  login() {
    const regexSegura = /^[A-Z].*[\W_].*$/;

    if (!regexSegura.test(this.password)) {
      this.error = 'La contraseña debe iniciar con mayúscula y contener al menos un signo especial.';
      return;
    }

    if (this.usuario.trim() === 'admin' && this.password === 'Admin12345678.') {
      this.error = '';
      localStorage.setItem('isLoggedIn', 'true');
      this.router.navigate(['/vehiculos']);
    } else {
      this.error = 'Usuario o contraseña incorrectos. Inténtalo de nuevo.';
    }
  }
}