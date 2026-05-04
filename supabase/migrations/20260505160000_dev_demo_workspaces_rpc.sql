-- Dev/demo: ensure canonical multi-tenant workspaces exist and the caller is a member.
-- Precision org gets optional realistic seed via seed_precision_biomedical_demo_if_empty().
-- Intended to be invoked from the app in development (see ActiveOrganizationProvider).

-- -----------------------------------------------------------------------------
-- ensure_dev_demo_workspace_orgs: create demo orgs by slug (idempotent) + owner membership
-- -----------------------------------------------------------------------------

create or replace function public.ensure_dev_demo_workspace_orgs()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  uid uuid := auth.uid();
  rec record;
  v_org_id uuid;
begin
  if uid is null then
    return;
  end if;

  for rec in
    select *
    from (
      values
        ('acme'::citext, 'Acme Field Services'::text),
        ('zephyr'::citext, 'Zephyr Equipment Co.'::text),
        ('medology'::citext, 'Medology Solutions'::text),
        ('precision-biomedical-demo'::citext, 'Precision Biomedical Services'::text)
    ) as t(slug, org_name)
  loop
    select o.id into v_org_id
    from public.organizations o
    where o.slug = rec.slug
    limit 1;

    if v_org_id is null then
      insert into public.organizations (name, slug, created_by)
      values (rec.org_name, rec.slug, uid)
      returning id into v_org_id;
    end if;

    insert into public.organization_members (organization_id, user_id, role, status, invited_by)
    values (v_org_id, uid, 'owner', 'active', uid)
    on conflict (organization_id, user_id) do nothing;
  end loop;
end;
$$;

revoke all on function public.ensure_dev_demo_workspace_orgs() from public;
grant execute on function public.ensure_dev_demo_workspace_orgs() to authenticated;
alter function public.ensure_dev_demo_workspace_orgs() owner to postgres;

-- -----------------------------------------------------------------------------
-- seed_precision_biomedical_demo_if_empty: medical demo payload (once per org)
-- -----------------------------------------------------------------------------

create or replace function public.seed_precision_biomedical_demo_if_empty()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  uid uuid := auth.uid();
  oid uuid;
  c1 uuid;
  c2 uuid;
  c3 uuid;
  e1 uuid;
  e2 uuid;
  e3 uuid;
  e4 uuid;
  rl jsonb;
begin
  if uid is null then
    return;
  end if;

  select o.id into oid
  from public.organizations o
  where o.slug = 'precision-biomedical-demo'::citext
  limit 1;

  if oid is null then
    return;
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = oid
      and om.user_id = uid
      and om.status = 'active'
  ) then
    return;
  end if;

  if exists (select 1 from public.customers where organization_id = oid limit 1) then
    return;
  end if;

  insert into public.customers (organization_id, company_name, status, joined_at, created_by)
  values (oid, 'Valley Regional Hospital', 'active', '2023-06-01', uid)
  returning id into c1;

  insert into public.customers (organization_id, company_name, status, joined_at, created_by)
  values (oid, 'Summit Surgical Center', 'active', '2023-06-01', uid)
  returning id into c2;

  insert into public.customers (organization_id, company_name, status, joined_at, created_by)
  values (oid, 'Riverstone Imaging Center', 'active', '2023-06-01', uid)
  returning id into c3;

  insert into public.customer_locations (
    organization_id, customer_id, name, address_line1, city, state, postal_code, is_default
  )
  values
    (oid, c1, 'Main campus', '1515 N Van Ness Ave', 'Fresno', 'CA', '93721', true),
    (oid, c2, 'Primary', '575 S Bascom Ave', 'San Jose', 'CA', '95110', true),
    (oid, c3, 'Radiology wing', '2801 K St', 'Sacramento', 'CA', '95816', true);

  insert into public.customer_contacts (
    organization_id, customer_id, full_name, role, email, phone, is_primary
  )
  values
    (oid, c1, 'Jordan Lee', 'Clinical Engineering', 'ce.valley@pbs-demo.local', '(559) 555-0101', true),
    (oid, c2, 'Priya Shah', 'Facilities', 'facilities.summit@pbs-demo.local', '(408) 555-0142', true),
    (oid, c3, 'Marcus Chen', 'Imaging Director', 'imaging.riverstone@pbs-demo.local', '(916) 555-0199', true);

  insert into public.equipment (
    organization_id, customer_id, equipment_code, name, manufacturer, category, serial_number,
    status, install_date, warranty_expires_at, last_service_at, next_due_at, location_label, notes, created_by
  )
  values
    (
      oid, c1, 'PBS-0001', 'IntelliVue MX750 Patient Monitor', 'Philips', 'Patient monitoring',
      'SN-PBS-2021-10001', 'active', '2021-03-15', '2027-03-15', '2026-02-10', '2026-06-01',
      'ICU Pod B', 'Biomedical asset — demo seed.', uid
    )
  returning id into e1;

  insert into public.equipment (
    organization_id, customer_id, equipment_code, name, manufacturer, category, serial_number,
    status, install_date, warranty_expires_at, last_service_at, next_due_at, location_label, notes, created_by
  )
  values
    (
      oid, c2, 'PBS-0002', 'CARESCAPE B850 Monitor', 'GE HealthCare', 'Patient monitoring',
      'SN-PBS-2022-10002', 'active', '2022-01-10', '2028-01-10', '2026-01-20', '2026-05-15',
      'Step-down Unit', 'Biomedical asset — demo seed.', uid
    )
  returning id into e2;

  insert into public.equipment (
    organization_id, customer_id, equipment_code, name, manufacturer, category, serial_number,
    status, install_date, warranty_expires_at, last_service_at, next_due_at, location_label, notes, created_by
  )
  values
    (
      oid, c3, 'PBS-0003', 'LOGIQ E10 Ultrasound', 'GE HealthCare', 'Imaging',
      'SN-PBS-2020-10003', 'needs_service', '2020-08-01', '2026-08-01', '2025-11-01', '2026-04-20',
      'Imaging Suite 2', 'Biomedical asset — demo seed.', uid
    )
  returning id into e3;

  insert into public.equipment (
    organization_id, customer_id, equipment_code, name, manufacturer, category, serial_number,
    status, install_date, warranty_expires_at, last_service_at, next_due_at, location_label, notes, created_by
  )
  values
    (
      oid, c1, 'PBS-0004', 'AMSCO 400 Small Steam Sterilizer', 'STERIS', 'Sterilization',
      'SN-PBS-2019-10004', 'active', '2019-05-20', '2026-05-20', '2026-02-01', '2026-07-01',
      'Central Sterile', 'Biomedical asset — demo seed.', uid
    )
  returning id into e4;

  insert into public.maintenance_plans (
    organization_id, customer_id, equipment_id, assigned_user_id, name, status, priority,
    interval_value, interval_unit, last_service_date, next_due_date, auto_create_work_order,
    notes, services, notification_rules, created_by
  )
  values
    (
      oid, c1, e1, uid, 'Annual electrical safety (SEP) & performance verification', 'active', 'normal',
      1, 'year', '2025-06-01', '2026-06-01', true,
      'Demo preventive maintenance — marketing seed.',
      '[{"name":"Visual inspection & safety interlocks","interval":"Annual"}]'::jsonb,
      '[{"id":"r-1","offsetDays":14,"channel":"email","target":"clinical.engineering@demo.org"}]'::jsonb,
      uid
    ),
    (
      oid, c2, e2, uid, 'Quarterly patient monitor PM & alarm test', 'active', 'normal',
      3, 'month', '2026-01-01', '2026-04-01', true,
      'Demo preventive maintenance — marketing seed.',
      '[{"name":"Functional test & documentation","interval":"Quarterly"}]'::jsonb,
      '[]'::jsonb,
      uid
    ),
    (
      oid, c3, e3, uid, 'Semi-annual imaging QA & detector calibration', 'paused', 'high',
      6, 'month', '2025-09-01', '2026-03-01', false,
      'Paused pending probe evaluation.',
      '[{"name":"QA phantom & reject analysis","interval":"Semi-annual"}]'::jsonb,
      '[]'::jsonb,
      uid
    ),
    (
      oid, c1, e4, uid, 'Monthly sterilizer biological indicator program', 'active', 'normal',
      1, 'month', '2026-02-01', '2026-03-01', true,
      'SPD compliance cadence — demo.',
      '[{"name":"BI incubation & log review","interval":"Monthly"}]'::jsonb,
      '[]'::jsonb,
      uid
    );

  rl := jsonb_build_object(
    'problemReported', 'Service request: Patient monitor arrhythmia algorithm verification',
    'diagnosis', 'Field assessment documented; corrective actions per manufacturer IFU.',
    'partsUsed', '[]'::jsonb,
    'laborHours', 0,
    'technicianNotes', 'Biomed documentation attached to CMMS.',
    'photos', '[]'::jsonb,
    'signatureDataUrl', '',
    'signedBy', '',
    'signedAt', '',
    'tasks', '[]'::jsonb
  );

  insert into public.work_orders (
    organization_id, customer_id, equipment_id, title, status, priority, type,
    scheduled_on, scheduled_time, completed_at, assigned_user_id, invoice_number,
    total_labor_cents, total_parts_cents, repair_log, notes, created_by
  )
  values
    (
      oid, c1, e1, 'Patient monitor arrhythmia algorithm verification after software upgrade',
      'scheduled', 'normal', 'inspection', '2026-05-12', '09:30:00', null, uid, null,
      18500, 3200, rl, 'Demo seed work order.', uid
    ),
    (
      oid, c2, e2, 'Quarterly infusion pump channel calibration (IEC 60601-2-24)',
      'in_progress', 'high', 'pm', '2026-05-08', '13:00:00', null, uid, null,
      22000, 0, rl, 'Demo seed work order.', uid
    ),
    (
      oid, c3, e3, 'Portable X-ray image quality degradation — detector calibration',
      'open', 'normal', 'repair', '2026-05-20', '10:00:00', null, uid, null,
      15000, 4500, rl, 'Demo seed work order.', uid
    ),
    (
      oid, c1, e4, 'Sterilizer cycle fault — chamber temperature variance during exhaust',
      'open', 'critical', 'emergency', '2026-05-03', '08:00:00', null, uid, null,
      9500, 12000, rl, 'Demo seed work order.', uid
    ),
    (
      oid, c1, e1, 'Annual electrical safety & performance verification (SEP-1)',
      'completed', 'normal', 'pm', '2026-03-01', '08:00:00', '2026-03-01T17:00:00Z', uid, null,
      24000, 800, rl, 'Demo seed work order.', uid
    ),
    (
      oid, c2, e2, 'Preventive maintenance: patient monitoring network switch audit',
      'invoiced', 'low', 'inspection', '2026-02-15', '11:00:00', '2026-02-16T15:00:00Z', uid,
      'INV-PBS-20260001',
      8800, 0, rl, 'Demo seed work order.', uid
    );
end;
$$;

revoke all on function public.seed_precision_biomedical_demo_if_empty() from public;
grant execute on function public.seed_precision_biomedical_demo_if_empty() to authenticated;
alter function public.seed_precision_biomedical_demo_if_empty() owner to postgres;
