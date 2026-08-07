import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api';
import { Employee } from '../../../models';

export interface OrgNode {
  emp: Employee & { designation?: string };
  children: OrgNode[];
  collapsed: boolean;
  initials: string;
  avatarColor: string;
}

const AVATAR_COLORS = [
  '#0066CC','#059669','#D97706','#7C3AED',
  '#DC2626','#0891B2','#65A30D','#DB2777',
  '#EA580C','#0284C7','#16A34A','#9333EA',
];

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

@Component({
  selector: 'app-organogram',
  standalone: true,
  imports: [CommonModule, FormsModule, NgTemplateOutlet],
  templateUrl: './organogram.html',
  styleUrl: './organogram.scss',
})
export class Organogram implements OnInit {
  private api = inject(ApiService);

  loading    = signal(true);
  search     = signal('');
  deptFilter = signal('');

  private allEmployees = signal<(Employee & { designation?: string })[]>([]);

  readonly departments = computed(() => {
    const depts = new Set<string>();
    this.allEmployees().forEach(e => { if (e.department) depts.add(e.department); });
    return Array.from(depts).sort();
  });

  readonly roots = computed(() => this.buildTree());

  ngOnInit(): void {
    this.api.getEmployees().subscribe({
      next: emps => {
        this.allEmployees.set(emps as any[]);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private buildTree(): OrgNode[] {
    const q    = this.search().toLowerCase().trim();
    const dept = this.deptFilter();
    let emps   = this.allEmployees();

    if (q) {
      emps = emps.filter(e =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
        (e.department ?? '').toLowerCase().includes(q) ||
        ((e as any).designation ?? '').toLowerCase().includes(q)
      );
    }
    if (dept) {
      emps = emps.filter(e => e.department === dept);
    }

    const nodeMap = new Map<string, OrgNode>();
    emps.forEach(e => {
      nodeMap.set(e.id, {
        emp: e,
        children: [],
        collapsed: false,
        initials: `${e.first_name?.[0] ?? ''}${e.last_name?.[0] ?? ''}`.toUpperCase(),
        avatarColor: colorFor(e.id),
      });
    });

    const roots: OrgNode[] = [];
    emps.forEach(e => {
      const node = nodeMap.get(e.id)!;
      const mgr  = e.manager_id ? nodeMap.get(e.manager_id) : null;
      if (mgr) {
        mgr.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortNodes = (nodes: OrgNode[]) => {
      nodes.sort((a, b) =>
        `${a.emp.first_name} ${a.emp.last_name}`.localeCompare(`${b.emp.first_name} ${b.emp.last_name}`)
      );
      nodes.forEach(n => sortNodes(n.children));
    };
    sortNodes(roots);
    return roots;
  }

  toggle(node: OrgNode): void { node.collapsed = !node.collapsed; }

  expandAll():   void { this.setCollapsed(this.roots(), false); }
  collapseAll(): void { this.setCollapsed(this.roots(), true);  }

  private setCollapsed(nodes: OrgNode[], val: boolean): void {
    nodes.forEach(n => { n.collapsed = val; this.setCollapsed(n.children, val); });
  }

  get totalCount(): number { return this.allEmployees().length; }

  exportCSV(): void {
    const rows = [['Name','Department','Designation','Manager ID','Employee ID']];
    this.allEmployees().forEach(e => {
      rows.push([
        `${e.first_name} ${e.last_name}`,
        e.department ?? '',
        (e as any).designation ?? '',
        e.manager_id ?? '',
        e.id,
      ]);
    });
    const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'organogram.csv'; a.click();
    URL.revokeObjectURL(url);
  }
}
