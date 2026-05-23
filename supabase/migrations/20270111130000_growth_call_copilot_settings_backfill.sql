-- Repair Growth Call Copilot settings backfill (6.2A).
-- Ensures call_copilot_enabled aligns with ai_copilot_enabled for existing rows
-- when call copilot was added after AI copilot was already enabled.

update growth.copilot_settings
set
  call_copilot_enabled = true,
  call_copilot_require_summary_approval = coalesce(call_copilot_require_summary_approval, true)
where ai_copilot_enabled = true
  and call_copilot_enabled = false;

-- Safety: never leave summary approval null if column exists without NOT NULL (defensive).
update growth.copilot_settings
set call_copilot_require_summary_approval = true
where call_copilot_require_summary_approval is null;
