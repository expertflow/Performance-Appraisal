import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Employee, Project } from '../models';

@Injectable({ providedIn: 'root' })
export class DirectusService {
  private base = environment.directusUrl;

  constructor(private http: HttpClient) {}

  private headers(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getEmployees(token: string, search?: string): Observable<Employee[]> {
    const filter = search
      ? `&filter[_or][0][first_name][_contains]=${search}&filter[_or][1][last_name][_contains]=${search}`
      : '';
    return this.http
      .get<{ data: any[] }>(`${this.base}/items/employee?fields=id,first_name,last_name,email,department,job_title${filter}`, {
        headers: this.headers(token)
      })
      .pipe(map(r => r.data));
  }

  getProjects(token: string): Observable<Project[]> {
    return this.http
      .get<{ data: any[] }>(`${this.base}/items/project?fields=id,name,status,type`, {
        headers: this.headers(token)
      })
      .pipe(map(r => r.data));
  }

  getTimeEntries(token: string, since?: string): Observable<any[]> {
    const filter = since ? `&filter[date_updated][_gte]=${since}` : '';
    return this.http
      .get<{ data: any[] }>(
        `${this.base}/items/time_entry?fields=id,employee,project,description,start_datetime,end_datetime,hours_worked${filter}`,
        { headers: this.headers(token) }
      )
      .pipe(map(r => r.data));
  }

  createTimeEntry(token: string, entry: any): Observable<any> {
    return this.http
      .post<{ data: any }>(`${this.base}/items/time_entry`, entry, {
        headers: this.headers(token)
      })
      .pipe(map(r => r.data));
  }

  updateTimeEntry(token: string, id: string, patch: any): Observable<any> {
    return this.http
      .patch<{ data: any }>(`${this.base}/items/time_entry/${id}`, patch, {
        headers: this.headers(token)
      })
      .pipe(map(r => r.data));
  }
}
