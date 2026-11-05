import { Component, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import {
  LAB_AROUND_THE_HOUSE, LAB_DEFAULT_MACHINE, LAB_MACHINES, LAB_ON_AIR, LAB_SERVICES, LabMachine, LabMachineId, LabPlace,
  LabStatusId, runningSummary,
} from '../../shared/constants/lab.const';
import { SITE_CONFIG } from '../../shared/config/site.config';
import { cachedJson } from '../../shared/services/cached-json';
import { relativeTime } from '../../shared/services/relative-time';
import { LAB_STATUS_TTL_MS, toLabStatus } from './lab-status';

interface MachineGroup {
  place: LabPlace;
  label: string;
  machines: readonly LabMachine[];
}

const GROUP_LABELS: Record<LabPlace, string> = { rack: 'office rack', closet: 'the closet', edge: 'out front' };

const groupOf = (place: LabPlace): MachineGroup =>
  ({ place, label: GROUP_LABELS[place], machines: LAB_MACHINES.filter(m => m.place === place) });

/**
 * /lab, off the homelab's poster on Projects: the machines in Morgan's office rack and closet (drawn in
 * CSS, each a button that shows its spec sheet), what's on the air with live up/down pills from the
 * status Worker, and everything they run. On phones the machines are a list whose selected one opens
 * its sheet beneath it (an accordion); both layouts share one selection, BIG HOSS by default.
 */
@Component({
  selector: 'app-lab-page',
  imports: [BasePageComponent, PageHeaderComponent, NgTemplateOutlet],
  templateUrl: './lab-page.component.html',
  styleUrl: './lab-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabPageComponent {
  /** The rack and the closet side by side, then the VPS on its own line. */
  protected readonly stacks: readonly MachineGroup[] = [groupOf('rack'), groupOf('closet')];
  protected readonly edge: MachineGroup = groupOf('edge');
  protected readonly groups: readonly MachineGroup[] = [...this.stacks, this.edge];

  protected readonly onAir = LAB_ON_AIR;
  protected readonly services = LAB_SERVICES;
  protected readonly runningSummary = runningSummary();
  protected readonly aroundTheHouse = LAB_AROUND_THE_HOUSE;

  protected readonly selectedId = signal<LabMachineId>(LAB_DEFAULT_MACHINE);
  /** Only the phone list folds: pressing the open machine there closes it. The sheet beside the rack is always there. */
  protected readonly open = signal(true);
  protected readonly selected = computed(() => LAB_MACHINES.find(m => m.id === this.selectedId()) ?? LAB_MACHINES[0]);

  private readonly status = cachedJson(SITE_CONFIG.labStatusUrl, LAB_STATUS_TTL_MS, toLabStatus);
  /** "3 minutes ago", once there's a status to go by. */
  protected readonly checkedAgo = computed(() => {
    const status = this.status();
    return status ? relativeTime(Date.parse(status.checkedAt)) : '';
  });

  /** A machine pressed in the rack: show its sheet. */
  protected pick(id: LabMachineId): void {
    this.selectedId.set(id);
    this.open.set(true);
  }

  /** A machine pressed in the phone list: open it, or fold it if it's the one open. */
  protected toggle(id: LabMachineId): void {
    if (this.selectedId() === id) {
      this.open.update(open => !open);
    } else {
      this.pick(id);
    }
  }

  /** "up" or "down" from the status Worker, or null (no pill) until it has answered properly. */
  protected stateOf(id: LabStatusId): 'up' | 'down' | null {
    return this.status()?.services[id] ?? null;
  }
}
