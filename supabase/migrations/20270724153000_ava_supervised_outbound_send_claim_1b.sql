-- AVA-SUPERVISED-OUTBOUND-1B — Atomic supervised Ava send claim (generation row lock).

create or replace function growth.claim_ava_supervised_outbound_send(
  p_generation_id uuid,
  p_claim jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = growth, public
as $$
declare
  v_row growth.ai_copilot_generations%rowtype;
  v_status text;
begin
  select *
  into v_row
  from growth.ai_copilot_generations
  where id = p_generation_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_status := coalesce(v_row.classification -> 'avaSupervisedOutboundSendLifecycle' ->> 'status', '');

  if v_row.status <> 'approved' or v_row.sent_at is not null then
    return jsonb_build_object('ok', false, 'code', 'generation_not_approved');
  end if;

  if v_status = 'sending' then
    return jsonb_build_object('ok', false, 'code', 'send_in_progress');
  end if;

  if v_status = 'sent' then
    return jsonb_build_object('ok', false, 'code', 'already_sent');
  end if;

  if v_status = 'delivery_unknown' then
    return jsonb_build_object('ok', false, 'code', 'delivery_unknown_requires_reconciliation');
  end if;

  if v_status <> '' and v_status <> 'failed' then
    return jsonb_build_object('ok', false, 'code', 'send_claim_blocked');
  end if;

  update growth.ai_copilot_generations
  set classification = jsonb_set(
    coalesce(classification, '{}'::jsonb),
    '{avaSupervisedOutboundSendLifecycle}',
    p_claim,
    true
  )
  where id = p_generation_id;

  select *
  into v_row
  from growth.ai_copilot_generations
  where id = p_generation_id;

  return jsonb_build_object('ok', true, 'generation', to_jsonb(v_row));
end;
$$;

revoke all on function growth.claim_ava_supervised_outbound_send(uuid, jsonb) from public, anon, authenticated;
grant execute on function growth.claim_ava_supervised_outbound_send(uuid, jsonb) to service_role;

comment on function growth.claim_ava_supervised_outbound_send(uuid, jsonb) is
  'AVA-SUPERVISED-OUTBOUND-1B — atomically claim an approved Ava generation for supervised outbound send.';
