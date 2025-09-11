-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Sep 10, 2025 at 08:38 PM
-- Server version: 10.6.23-MariaDB
-- PHP Version: 8.4.11

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `hctdron1_frc_scouting`
--

-- --------------------------------------------------------

--
-- Table structure for table `matches_schedule`
--

CREATE TABLE `matches_schedule` (
  `match_key` varchar(64) NOT NULL,
  `event_key` varchar(32) NOT NULL,
  `comp_level` varchar(8) NOT NULL,
  `set_number` int(11) NOT NULL DEFAULT 0,
  `match_number` int(11) NOT NULL DEFAULT 0,
  `time_utc` datetime DEFAULT NULL,
  `red1` int(11) DEFAULT NULL,
  `red2` int(11) DEFAULT NULL,
  `red3` int(11) DEFAULT NULL,
  `blue1` int(11) DEFAULT NULL,
  `blue2` int(11) DEFAULT NULL,
  `blue3` int(11) DEFAULT NULL,
  `field` varchar(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


--
-- Table structure for table `match_records`
--

CREATE TABLE `match_records` (
  `id` int(10) UNSIGNED NOT NULL,
  `match_key` varchar(64) NOT NULL,
  `alliance` varchar(8) DEFAULT NULL,
  `position` varchar(8) DEFAULT NULL,
  `team_number` int(10) UNSIGNED NOT NULL,
  `metrics_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metrics_json`)),
  `penalties` int(10) UNSIGNED DEFAULT NULL,
  `broke_down` tinyint(1) DEFAULT NULL,
  `defense_played` tinyint(3) UNSIGNED DEFAULT NULL,
  `defended_by` tinyint(3) UNSIGNED DEFAULT NULL,
  `driver_skill` tinyint(3) UNSIGNED DEFAULT NULL,
  `card` varchar(16) DEFAULT NULL,
  `comments` text DEFAULT NULL,
  `scout_name` varchar(255) DEFAULT NULL,
  `device_id` varchar(255) DEFAULT NULL,
  `created_at_ms` bigint(20) UNSIGNED NOT NULL DEFAULT 0,
  `schema_version` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


--
-- Table structure for table `pit_records`
--

CREATE TABLE `pit_records` (
  `id` int(10) UNSIGNED NOT NULL,
  `event_key` varchar(64) NOT NULL,
  `team_number` int(10) UNSIGNED NOT NULL,
  `drivetrain` varchar(255) DEFAULT NULL,
  `weight_lb` decimal(6,2) DEFAULT NULL,
  `dims_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`dims_json`)),
  `autos` text DEFAULT NULL,
  `mechanisms_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`mechanisms_json`)),
  `notes` text DEFAULT NULL,
  `photos_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`photos_json`)),
  `scout_name` varchar(255) DEFAULT NULL,
  `device_id` varchar(255) DEFAULT NULL,
  `created_at_ms` bigint(20) UNSIGNED NOT NULL DEFAULT 0,
  `schema_version` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


--
-- Table structure for table `teams`
--

CREATE TABLE `teams` (
  `id` int(10) UNSIGNED NOT NULL,
  `team_number` int(10) UNSIGNED NOT NULL,
  `nickname` varchar(255) DEFAULT NULL,
  `name` text DEFAULT NULL,
  `city` varchar(255) DEFAULT NULL,
  `state_prov` varchar(128) DEFAULT NULL,
  `country` varchar(128) DEFAULT NULL,
  `rookie_year` int(11) DEFAULT NULL,
  `website` varchar(512) DEFAULT NULL,
  `created_at_ms` bigint(20) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `matches_schedule`
--
ALTER TABLE `matches_schedule`
  ADD PRIMARY KEY (`match_key`),
  ADD KEY `event_key` (`event_key`),
  ADD KEY `time_utc` (`time_utc`);

--
-- Indexes for table `match_records`
--
ALTER TABLE `match_records`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_match_team` (`match_key`,`team_number`),
  ADD KEY `team_number` (`team_number`),
  ADD KEY `created_at_ms` (`created_at_ms`);

--
-- Indexes for table `pit_records`
--
ALTER TABLE `pit_records`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_pit_event_team` (`event_key`,`team_number`),
  ADD KEY `event_key` (`event_key`),
  ADD KEY `team_number` (`team_number`),
  ADD KEY `created_at_ms` (`created_at_ms`);

--
-- Indexes for table `teams`
--
ALTER TABLE `teams`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_team_number` (`team_number`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `match_records`
--
ALTER TABLE `match_records`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `pit_records`
--
ALTER TABLE `pit_records`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `teams`
--
ALTER TABLE `teams`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=139;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
