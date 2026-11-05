import { supabase } from '../lib/supabaseClient';
import { DEFAULT_SLA_MINUTES } from '../constants/task';
import { unwrap } from './errors';

/** Master lists grouped by kind: { center: [{ id, value }], ... } */
export async function listMasters() {
  const { data } = unwrap(
    await supabase.from('master_items').select('id, kind, value, sort_order').order('sort_order').order('value'),
    'Unable to load master lists.',
  );
  return (data ?? []).reduce((acc, m) => {
    (acc[m.kind] ??= []).push({ id: m.id, value: m.value });
    return acc;
  }, {});
}

export async function addMaster(kind, value) {
  unwrap(await supabase.from('master_items').insert({ kind, value: value.trim() }), 'Unable to add the value.');
}

export async function removeMaster(id) {
  const { data } = unwrap(await supabase.from('master_items').delete().eq('id', id).select('id'), 'Unable to remove the value.');
  if (!data?.length) throw new Error('Value not found, or you do not have permission to remove it.');
}

/** { Critical: 240, High: 480, ... } resolution minutes per priority */
export async function getSlaMinutes() {
  const { data } = unwrap(await supabase.from('sla_policies').select('priority, resolution_minutes'), 'Unable to load SLA policies.');
  return { ...DEFAULT_SLA_MINUTES, ...Object.fromEntries((data ?? []).map((r) => [r.priority, r.resolution_minutes])) };
}
