import { Column, Entity, PrimaryColumn } from 'typeorm';
import { bigintTransformer } from '../common/bigint.transformer';

/** Catálogo de zonas de farm. Seedado (Greenwood). */
@Entity('zones')
export class Zone {
  @PrimaryColumn({ type: 'smallint' })
  id!: number;

  @Column({ type: 'text' })
  name!: string;

  @Column({
    name: 'min_power_score',
    type: 'bigint',
    default: 0,
    transformer: bigintTransformer,
  })
  minPowerScore!: number;

  @Column({ name: 'xp_rate_per_power_sec', type: 'real' })
  xpRatePerPowerSec!: number;

  @Column({ name: 'gold_rate_per_power_sec', type: 'real' })
  goldRatePerPowerSec!: number;

  @Column({ name: 'offline_cap_seconds', type: 'int', default: 28800 })
  offlineCapSeconds!: number;
}
