import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-ask-morgan-form',
  imports: [FormsModule, CommonModule],
  templateUrl: './ask-morgan-form.html',
  styleUrl: './ask-morgan-form.scss',
})
export class AskMorganFormComponent {
  question = '';
  username_honey = '';
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';
  isSuccess = false;

  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);

  async submitForm() {
    if (!this.question.trim()) return;
    
    // Honeypot short-circuit: fail silently to prevent spam
    if (this.username_honey.trim()) {
      this.successMessage = 'Thanks for reaching out! Your message was sent anonymously.';
      this.isSuccess = true;
      this.cdr.detectChanges();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      const payload = {
        question: this.question,
        username_honey: this.username_honey
      };
      
      await firstValueFrom(
        this.http.post('https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-fb12a0f7-e7af-4149-8e0a-f676ef64d868/ask/submit', payload)
      );

      this.successMessage = 'Thanks for reaching out! Your message was sent anonymously.';
      this.isSuccess = true;
    } catch {
      this.errorMessage = 'Network error occurred. Please try again later.';
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  resetForm() {
    this.isSuccess = false;
    this.successMessage = '';
    this.question = '';
    this.username_honey = '';
    this.cdr.detectChanges();
  }
}
