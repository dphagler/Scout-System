DELETE FROM match_records WHERE match_key LIKE '2024gaalb%';
DELETE FROM pit_records WHERE event_key='2024gaalb';

INSERT INTO match_records (
  match_key, alliance, position, team_number,
  metrics_json, penalties, broke_down, defense_played, defended_by,
  driver_skill, card, comments, scout_name, device_id, created_at_ms, schema_version
)
SELECT match_key, 'red', 'red1', red1,
  '{"auto_notes_speaker":0,"auto_notes_amp":0,"auto_leave":false,"teleop_notes_speaker":0,"teleop_notes_amp":0,"teleop_missed":0,"endgame":"none","trap_scored":false}',
  0,0,0,0,3,'none','generated','AutoGen','dev_sim',0,2
FROM matches_schedule WHERE event_key='2024gaalb' AND red1 IS NOT NULL
UNION ALL
SELECT match_key, 'red', 'red2', red2,
  '{"auto_notes_speaker":0,"auto_notes_amp":0,"auto_leave":false,"teleop_notes_speaker":0,"teleop_notes_amp":0,"teleop_missed":0,"endgame":"none","trap_scored":false}',
  0,0,0,0,3,'none','generated','AutoGen','dev_sim',0,2
FROM matches_schedule WHERE event_key='2024gaalb' AND red2 IS NOT NULL
UNION ALL
SELECT match_key, 'red', 'red3', red3,
  '{"auto_notes_speaker":0,"auto_notes_amp":0,"auto_leave":false,"teleop_notes_speaker":0,"teleop_notes_amp":0,"teleop_missed":0,"endgame":"none","trap_scored":false}',
  0,0,0,0,3,'none','generated','AutoGen','dev_sim',0,2
FROM matches_schedule WHERE event_key='2024gaalb' AND red3 IS NOT NULL
UNION ALL
SELECT match_key, 'blue', 'blue1', blue1,
  '{"auto_notes_speaker":0,"auto_notes_amp":0,"auto_leave":false,"teleop_notes_speaker":0,"teleop_notes_amp":0,"teleop_missed":0,"endgame":"none","trap_scored":false}',
  0,0,0,0,3,'none','generated','AutoGen','dev_sim',0,2
FROM matches_schedule WHERE event_key='2024gaalb' AND blue1 IS NOT NULL
UNION ALL
SELECT match_key, 'blue', 'blue2', blue2,
  '{"auto_notes_speaker":0,"auto_notes_amp":0,"auto_leave":false,"teleop_notes_speaker":0,"teleop_notes_amp":0,"teleop_missed":0,"endgame":"none","trap_scored":false}',
  0,0,0,0,3,'none','generated','AutoGen','dev_sim',0,2
FROM matches_schedule WHERE event_key='2024gaalb' AND blue2 IS NOT NULL
UNION ALL
SELECT match_key, 'blue', 'blue3', blue3,
  '{"auto_notes_speaker":0,"auto_notes_amp":0,"auto_leave":false,"teleop_notes_speaker":0,"teleop_notes_amp":0,"teleop_missed":0,"endgame":"none","trap_scored":false}',
  0,0,0,0,3,'none','generated','AutoGen','dev_sim',0,2
FROM matches_schedule WHERE event_key='2024gaalb' AND blue3 IS NOT NULL;

INSERT INTO pit_records (
  event_key, team_number, drivetrain, weight_lb, dims_json,
  autos, mechanisms_json, notes, photos_json,
  scout_name, device_id, created_at_ms, schema_version
)
SELECT '2024gaalb', t.tnum, 'swerve', 0.0, '{"h":0,"w":0,"l":0}',
  'mobility auto', '{"intake":false,"shooter":false,"climber":false}',
  'generated pit data', '[]',
  'AutoGen', 'dev_pit', 0, 2
FROM (
  SELECT red1 AS tnum FROM matches_schedule WHERE event_key='2024gaalb'
  UNION SELECT red2 FROM matches_schedule WHERE event_key='2024gaalb'
  UNION SELECT red3 FROM matches_schedule WHERE event_key='2024gaalb'
  UNION SELECT blue1 FROM matches_schedule WHERE event_key='2024gaalb'
  UNION SELECT blue2 FROM matches_schedule WHERE event_key='2024gaalb'
  UNION SELECT blue3 FROM matches_schedule WHERE event_key='2024gaalb'
) AS t
WHERE t.tnum IS NOT NULL
ORDER BY t.tnum;
