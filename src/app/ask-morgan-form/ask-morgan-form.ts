import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ask-morgan-form',
  imports: [FormsModule, CommonModule],
  templateUrl: './ask-morgan-form.html',
  styleUrl: './ask-morgan-form.scss',
})
export class AskMorganForm {
  question = '';
  username_honey = '';
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';
  isSuccess = false;

  constructor(private cdr: ChangeDetectorRef) {}

  async submitForm() {
    if (!this.question.trim()) return;
    
    this.isSubmitting = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      const response = await fetch('https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-fb12a0f7-e7af-4149-8e0a-f676ef64d868/ask/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: this.question,
          username_honey: this.username_honey
        })
      });

      if (response.ok) {
        this.successMessage = 'Thanks for reaching out! Your message was sent anonymously.';
        this.isSuccess = true;
      } else {
        this.errorMessage = 'Failed to send message. Please try again later.';
      }
    } catch (error) {
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
