import { Injectable, signal } from '@angular/core';

/**
 * Shared search service — the shell topbar writes to `query`,
 * and each page reads from it to filter its own content.
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  /** Current search query typed in the topbar */
  readonly query = signal('');

  set(value: string) {
    this.query.set(value);
  }

  clear() {
    this.query.set('');
  }
}
