DELETE FROM match_records WHERE match_key LIKE '2024gaalb%';
DELETE FROM pit_records WHERE event_key='2024gaalb';

START TRANSACTION;

-- Match records
INSERT INTO match_records
(match_key, alliance, position, team_number, metrics_json,
 penalties, broke_down, defense_played, defense_resilience, driver_skill,
 card, comments, scout_name, device_id, created_at_ms, schema_version)
SELECT match_key,
       alliance,
       position,
       team_number,
       JSON_OBJECT(
         'auto_notes_speaker', FLOOR(RAND()*3),
         'auto_notes_amp', FLOOR(RAND()*2),
         'auto_leave', RAND()<0.8,
         'teleop_notes_speaker', CASE WHEN team_number IN (6919,1771,1261)
                                      THEN FLOOR(RAND()*6)+10 ELSE FLOOR(RAND()*6)+2 END,
         'teleop_notes_amp', FLOOR(RAND()*3),
         'teleop_missed', FLOOR(RAND()*3),
         'endgame', CASE
             WHEN RAND()<0.05 THEN 'harmonize'
             WHEN RAND()<0.15 THEN 'onstage'
             WHEN RAND()<0.25 THEN 'park'
             ELSE 'none'
           END,
         'trap_scored', RAND()<0.1
       ) AS metrics_json,
       FLOOR(RAND()*3) AS penalties,
       RAND()<0.05 AS broke_down,
       CASE WHEN team_number IN (4509,5074) THEN FLOOR(RAND()*4)+2
            ELSE FLOOR(RAND()*3) END AS defense_played,
       FLOOR(RAND()*4) AS defense_resilience,
       FLOOR(RAND()*5)+1 AS driver_skill,
       CASE
         WHEN team_number=3329 AND match_number=14 THEN 'yellow'
         WHEN team_number=5074 AND match_number=11 THEN 'yellow'
         WHEN team_number=4468 AND match_number=24 THEN 'red'
         ELSE 'none'
       END AS card,
       'sim data' AS comments,
       'QA Bot' AS scout_name,
       'dev_sim' AS device_id,
       UNIX_TIMESTAMP()*1000 AS created_at_ms,
       2 AS schema_version
FROM (
  SELECT m.match_key, m.match_number,
         IF(p.pos<=3,'red','blue') AS alliance,
         CASE p.pos
           WHEN 1 THEN 'red1'  WHEN 2 THEN 'red2'  WHEN 3 THEN 'red3'
           WHEN 4 THEN 'blue1' WHEN 5 THEN 'blue2' WHEN 6 THEN 'blue3'
         END AS position,
         CASE p.pos
           WHEN 1 THEN m.red1  WHEN 2 THEN m.red2  WHEN 3 THEN m.red3
           WHEN 4 THEN m.blue1 WHEN 5 THEN m.blue2 WHEN 6 THEN m.blue3
         END AS team_number
  FROM matches_schedule m
  JOIN (SELECT 1 pos UNION ALL SELECT 2 UNION ALL SELECT 3
        UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) p
  WHERE m.event_key='2024gaalb'
  ORDER BY m.match_number, p.pos
) AS s;

-- Pit records
INSERT INTO pit_records
(event_key, team_number, drivetrain, weight_lb, dims_json,
 autos, mechanisms_json, notes, photos_json,
 scout_name, device_id, created_at_ms, schema_version)
SELECT '2024gaalb',
       team_number,
       ELT(1+FLOOR(RAND()*3),'tank','swerve','mecanum') AS drivetrain,
       ROUND(90 + RAND()*30,2) AS weight_lb,
       JSON_OBJECT('h',24+FLOOR(RAND()*17),
                   'w',30+FLOOR(RAND()*3),
                   'l',30+FLOOR(RAND()*3)) AS dims_json,
       NULL,
       JSON_OBJECT('amp',RAND()<0.5,'trap',RAND()<0.3) AS mechanisms_json,
       'generated',
       JSON_ARRAY(CONCAT('https://picsum.photos/seed/',team_number,'/400/300')),
       'QA Bot',
       'dev_sim',
       UNIX_TIMESTAMP()*1000,
       2
FROM (
      SELECT red1 AS team_number FROM matches_schedule WHERE event_key='2024gaalb'
      UNION SELECT red2 FROM matches_schedule WHERE event_key='2024gaalb'
      UNION SELECT red3 FROM matches_schedule WHERE event_key='2024gaalb'
      UNION SELECT blue1 FROM matches_schedule WHERE event_key='2024gaalb'
      UNION SELECT blue2 FROM matches_schedule WHERE event_key='2024gaalb'
      UNION SELECT blue3 FROM matches_schedule WHERE event_key='2024gaalb'
     ) t
GROUP BY team_number
ORDER BY team_number;

COMMIT;
