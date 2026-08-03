import { Component } from '@angular/core';

@Component({
  selector: 'app-settings',
  imports: [],
  template: `
    <div class="page-header">
      <div>
        <h1>Settings</h1>
        <p>System configuration and preferences</p>
      </div>
    </div>
    <div class="card" style="text-align:center;padding:60px 20px;">
      <div style="font-size:48px;margin-bottom:16px;">⚙️</div>
      <h3 style="margin-bottom:8px;">System Settings</h3>
      <p style="color:var(--color-text-secondary);font-size:13px;">Settings configuration will be available in a future release.</p>
    </div>
  `
})
export class Settings {}
