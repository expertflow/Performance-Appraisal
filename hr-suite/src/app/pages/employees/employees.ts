import { Component } from '@angular/core';

@Component({
  selector: 'app-employees',
  imports: [],
  template: `
    <div class="page-header">
      <div>
        <h1>Employees</h1>
        <p>Manage employee records and profiles</p>
      </div>
      <button class="btn btn-primary btn-sm">+ Add Employee</button>
    </div>
    <div class="card" style="text-align:center;padding:60px 20px;">
      <div style="font-size:48px;margin-bottom:16px;">👤</div>
      <h3 style="margin-bottom:8px;">Employee Directory</h3>
      <p style="color:var(--color-text-secondary);font-size:13px;">This module is coming soon. Employee management will be available in a future release.</p>
    </div>
  `
})
export class Employees {}
