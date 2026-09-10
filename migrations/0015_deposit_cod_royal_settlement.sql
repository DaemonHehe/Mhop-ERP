-- Migration 0015: Deposit + COD Orders and Royal Express Settlement
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TYPE fulfillment_status ADD VALUE IF NOT EXISTS 'returned';

CREATE TABLE IF NOT EXISTS shipping_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sr_no integer UNIQUE NOT NULL,
  state_code varchar(20) NOT NULL,
  state_name varchar(80) NOT NULL,
  from_city varchar(80) NOT NULL DEFAULT 'Yangon',
  to_city varchar(120) NOT NULL,
  zone varchar(20) NOT NULL,
  normal_price numeric(14,2) NOT NULL CHECK(normal_price >= 0),
  courier_cost numeric(14,2) NOT NULL CHECK(courier_cost >= 0),
  next_kg_rate numeric(14,2) NOT NULL CHECK(next_kg_rate >= 0),
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS shipping_destinations_city_idx ON shipping_destinations(to_city);
CREATE INDEX IF NOT EXISTS shipping_destinations_state_idx ON shipping_destinations(state_code);

-- Insert 227 Royal Express Destinations
INSERT INTO shipping_destinations (sr_no, state_code, state_name, from_city, to_city, zone, normal_price, courier_cost, next_kg_rate) VALUES
(1, 'AYA', 'Ayeyarwady', 'Yangon', 'Hinthada', 'A', 4500, 4050, 1800),
(2, 'AYA', 'Ayeyarwady', 'Yangon', 'Maubin', 'A', 4500, 4050, 1800),
(3, 'AYA', 'Ayeyarwady', 'Yangon', 'Mawlamyinegyun', 'B', 5000, 4500, 1800),
(4, 'AYA', 'Ayeyarwady', 'Yangon', 'Myaungmya', 'A', 4500, 4050, 1800),
(5, 'AYA', 'Ayeyarwady', 'Yangon', 'Nyaungtone', 'A', 4500, 4050, 1800),
(6, 'AYA', 'Ayeyarwady', 'Yangon', 'Pathein', 'A', 4500, 4050, 1800),
(7, 'AYA', 'Ayeyarwady', 'Yangon', 'Pyapon', 'A', 4500, 4050, 1800),
(8, 'AYA', 'Ayeyarwady', 'Yangon', 'Wakema', 'A', 4500, 4050, 1800),
(9, 'AYA', 'Ayeyarwady', 'Yangon', 'Kyaiklat', 'A', 4500, 4050, 1800),
(10, 'AYA', 'Ayeyarwady', 'Yangon', 'Pantanaw', 'A', 4500, 4050, 1800),
(11, 'AYA', 'Ayeyarwady', 'Yangon', 'Zalun', 'A', 4500, 4050, 1800),
(12, 'AYA', 'Ayeyarwady', 'Yangon', 'Bogale', 'B', 5000, 4500, 1800),
(13, 'AYA', 'Ayeyarwady', 'Yangon', 'Labutta', 'B', 5000, 4500, 1800),
(14, 'AYA', 'Ayeyarwady', 'Yangon', 'Danubyu', 'A', 4500, 4050, 1800),
(15, 'AYA', 'Ayeyarwady', 'Yangon', 'Ngathaingchaung', 'A', 4500, 4050, 1800),
(16, 'AYA', 'Ayeyarwady', 'Yangon', 'Yegyi', 'A', 4500, 4050, 1800),
(17, 'AYA', 'Ayeyarwady', 'Yangon', 'Kyonpyaw', 'A', 4500, 4050, 1800),
(18, 'AYA', 'Ayeyarwady', 'Yangon', 'Ahtaung', 'A', 4500, 4050, 1800),
(19, 'AYA', 'Ayeyarwady', 'Yangon', 'Kyaunggon', 'A', 4500, 4050, 1800),
(20, 'AYA', 'Ayeyarwady', 'Yangon', 'Thabaung', 'B', 5000, 4500, 1800),
(21, 'AYA', 'Ayeyarwady', 'Yangon', 'Chaung Thar', 'B', 5000, 4500, 1800),
(22, 'AYA', 'Ayeyarwady', 'Yangon', 'Myanaung', 'B', 5000, 4500, 1800),
(23, 'AYA', 'Ayeyarwady', 'Yangon', 'Kyangin', 'B', 5000, 4500, 1800),
(24, 'AYA', 'Ayeyarwady', 'Yangon', 'Paungde', 'A', 4500, 4050, 1800),
(25, 'AYA', 'Ayeyarwady', 'Yangon', 'Einme', 'A', 4500, 4050, 1800),
(26, 'AYA', 'Ayeyarwady', 'Yangon', 'Dedaye', 'A', 4500, 4050, 1800),
(27, 'AYA', 'Ayeyarwady', 'Yangon', 'Kangyidaunt', 'A', 4500, 4050, 1800),
(28, 'AYA', 'Ayeyarwady', 'Yangon', 'Ngapudaw', 'B', 5000, 4500, 1800),
(29, 'AYA', 'Ayeyarwady', 'Yangon', 'Ingapu', 'B', 5000, 4500, 1800),
(30, 'AYA', 'Ayeyarwady', 'Yangon', 'Lemyethna', 'B', 5000, 4500, 1800),
(31, 'AYA', 'Ayeyarwady', 'Yangon', 'Kyonemangay', 'B', 5000, 4500, 1800),
(32, 'AYA', 'Ayeyarwady', 'Yangon', 'Htugyi', 'B', 5000, 4500, 1800),
(33, 'AYA', 'Ayeyarwady', 'Yangon', 'Pyinywa', 'A', 4500, 4050, 1800),
(34, 'AYA', 'Ayeyarwady', 'Yangon', 'Darka', 'A', 4500, 4050, 1800),
(35, 'AYA', 'Ayeyarwady', 'Yangon', 'Ngwesaung', 'B', 5000, 4500, 1800),
(36, 'AYA', 'Ayeyarwady', 'Yangon', 'Atthoke', 'A', 4500, 4050, 1800),
(37, 'AYA', 'Ayeyarwady', 'Yangon', 'Sar Ma Lauk', 'A', 4500, 4050, 1800),
(38, 'AYA', 'Ayeyarwady', 'Yangon', 'KwinKauk', 'B', 5000, 4500, 1800),
(39, 'BGO', 'Bago', 'Yangon', 'Bago', 'A', 4500, 4050, 1800),
(40, 'BGO', 'Bago', 'Yangon', 'Nyaunglebin', 'A', 4500, 4050, 1800),
(41, 'BGO', 'Bago', 'Yangon', 'Daik-U', 'A', 4500, 4050, 1800),
(42, 'BGO', 'Bago', 'Yangon', 'Phyu', 'A', 4500, 4050, 1800),
(43, 'BGO', 'Bago', 'Yangon', 'Pyay', 'A', 4500, 4050, 1800),
(44, 'BGO', 'Bago', 'Yangon', 'Taungoo', 'A', 4500, 4050, 1800),
(45, 'BGO', 'Bago', 'Yangon', 'Tharyarwaddy', 'A', 4500, 4050, 1800),
(46, 'BGO', 'Bago', 'Yangon', 'Thonese', 'A', 4500, 4050, 1800),
(47, 'BGO', 'Bago', 'Yangon', 'Gyobingauk', 'A', 4500, 4050, 1800),
(48, 'BGO', 'Bago', 'Yangon', 'Nattalin', 'A', 4500, 4050, 1800),
(49, 'BGO', 'Bago', 'Yangon', 'Yae Ni', 'A', 4500, 4050, 1800),
(50, 'BGO', 'Bago', 'Yangon', 'Letpadan', 'A', 4500, 4050, 1800),
(51, 'BGO', 'Bago', 'Yangon', 'Thanatpin', 'B', 5000, 4500, 1800),
(52, 'BGO', 'Bago', 'Yangon', 'Lower MinHla', 'A', 4500, 4050, 1800),
(53, 'BGO', 'Bago', 'Yangon', 'Kaytumaddy', 'A', 4500, 4050, 1800),
(54, 'BGO', 'Bago', 'Yangon', 'ShweDaung', 'A', 4500, 4050, 1800),
(55, 'BGO', 'Bago', 'Yangon', 'Inntakaw', 'A', 4500, 4050, 1800),
(56, 'BGO', 'Bago', 'Yangon', 'Waw', 'A', 4500, 4050, 1800),
(57, 'BGO', 'Bago', 'Yangon', 'Kyauktaga', 'A', 4500, 4050, 1800),
(58, 'BGO', 'Bago', 'Yangon', 'Yedashay', 'A', 4500, 4050, 1800),
(59, 'BGO', 'Bago', 'Yangon', 'Zigon', 'A', 4500, 4050, 1800),
(60, 'BGO', 'Bago', 'Yangon', 'Oktwin', 'A', 4500, 4050, 1800),
(61, 'BGO', 'Bago', 'Yangon', 'OkeShitPin', 'B', 5000, 4500, 1800),
(62, 'BGO', 'Bago', 'Yangon', 'Penwegon', 'A', 4500, 4050, 1800),
(63, 'BGO', 'Bago', 'Yangon', 'HpaYarGyi', 'A', 4500, 4050, 1800),
(64, 'BGO', 'Bago', 'Yangon', 'Monyo', 'B', 5000, 4500, 1800),
(65, 'BGO', 'Bago', 'Yangon', 'Paungtale', 'B', 5000, 4500, 1800),
(66, 'BGO', 'Bago', 'Yangon', 'Okpho', 'A', 4500, 4050, 1800),
(67, 'BGO', 'Bago', 'Yangon', 'Thegon', 'B', 5000, 4500, 1800),
(68, 'BGO', 'Bago', 'Yangon', 'Shwegyin', 'B', 5000, 4500, 1800),
(69, 'BGO', 'Bago', 'Yangon', 'Pyuntasa', 'A', 4500, 4050, 1800),
(70, 'BGO', 'Bago', 'Yangon', 'Innma', 'A', 4500, 4050, 1800),
(71, 'BGO', 'Bago', 'Yangon', 'Kanyutkwin', 'A', 4500, 4050, 1800),
(72, 'BGO', 'Bago', 'Yangon', 'Tharkaya', 'A', 4500, 4050, 1800),
(73, 'BGO', 'Bago', 'Yangon', 'Myohla', 'A', 4500, 4050, 1800),
(74, 'BGO', 'Bago', 'Yangon', 'Kawa', 'B', 5000, 4500, 1800),
(75, 'BGO', 'Bago', 'Yangon', 'Sitkwin', 'A', 4500, 4050, 1800),
(76, 'BGO', 'Bago', 'Yangon', 'Oaethaekone', 'A', 4500, 4050, 1800),
(77, 'BGO', 'Bago', 'Yangon', 'Shwelaung', 'A', 4500, 4050, 1800),
(78, 'BGO', 'Bago', 'Yangon', 'NyaungChayHtauk', 'B', 5000, 4500, 1800),
(79, 'BGO', 'Bago', 'Yangon', 'Swar', 'A', 4500, 4050, 1800),
(80, 'CHIN', 'Chin', 'Yangon', 'Hakha', 'G', 8500, 7650, 2700),
(81, 'KACHIN', 'Kachin', 'Yangon', 'Myitkyina', 'I', 10000, 9000, 2700),
(82, 'KACHIN', 'Kachin', 'Yangon', 'Mogaung', 'H', 9500, 8550, 2700),
(83, 'KACHIN', 'Kachin', 'Yangon', 'Mohnyin', 'H', 9500, 8550, 2700),
(84, 'KACHIN', 'Kachin', 'Yangon', 'Hpakan', 'I', 10000, 9000, 2700),
(85, 'KACHIN', 'Kachin', 'Yangon', 'Bhamaw', 'H', 9500, 8550, 2700),
(86, 'KACHIN', 'Kachin', 'Yangon', 'Waingmaw', 'H', 9500, 8550, 2700),
(87, 'KACHIN', 'Kachin', 'Yangon', 'Danai', 'I', 10000, 9000, 2700),
(88, 'KACHIN', 'Kachin', 'Yangon', 'Namti', 'H', 9500, 8550, 2700),
(89, 'KACHIN', 'Kachin', 'Yangon', 'Momauk', 'H', 9500, 8550, 2700),
(90, 'KAYAR', 'Kayah', 'Yangon', 'Loikaw', 'E', 7000, 6300, 2250),
(91, 'KAYIN', 'Kayin', 'Yangon', 'Hpa-An', 'A', 4500, 4050, 1800),
(92, 'KAYIN', 'Kayin', 'Yangon', 'Myawaddy', 'F', 8000, 7200, 2250),
(93, 'KAYIN', 'Kayin', 'Yangon', 'Kawkareik', 'E', 7000, 6300, 2250),
(94, 'KAYIN', 'Kayin', 'Yangon', 'Hlaingbwe', 'A', 4500, 4050, 1800),
(95, 'KAYIN', 'Kayin', 'Yangon', 'Myaingkalay', 'A', 4500, 4050, 1800),
(96, 'MDY', 'Mandalay', 'Yangon', 'Bagan', 'C', 5500, 4950, 1800),
(97, 'MDY', 'Mandalay', 'Yangon', 'Nyaung-U', 'C', 5500, 4950, 1800),
(98, 'MDY', 'Mandalay', 'Yangon', 'Kyaukse', 'B', 5000, 4500, 1800),
(99, 'MDY', 'Mandalay', 'Yangon', 'Mandalay', 'B', 5000, 4500, 1800),
(100, 'MDY', 'Mandalay', 'Yangon', 'Meiktila', 'B', 5000, 4500, 1800),
(101, 'MDY', 'Mandalay', 'Yangon', 'Wundwin', 'B', 5000, 4500, 1800),
(102, 'MDY', 'Mandalay', 'Yangon', 'Mahlaing', 'B', 5000, 4500, 1800),
(103, 'MDY', 'Mandalay', 'Yangon', 'Myingyan', 'C', 5500, 4950, 1800),
(104, 'MDY', 'Mandalay', 'Yangon', 'Pyawbwe', 'B', 5000, 4500, 1800),
(105, 'MDY', 'Mandalay', 'Yangon', 'Pyin Oo Lwin', 'B', 5000, 4500, 1800),
(106, 'MDY', 'Mandalay', 'Yangon', 'Yamethin', 'B', 5000, 4500, 1800),
(107, 'MDY', 'Mandalay', 'Yangon', 'Kyaukpadaung', 'C', 5500, 4950, 1800),
(108, 'MDY', 'Mandalay', 'Yangon', 'Sintgaing', 'B', 5000, 4500, 1800),
(109, 'MDY', 'Mandalay', 'Yangon', 'Kume', 'B', 5000, 4500, 1800),
(110, 'MDY', 'Mandalay', 'Yangon', 'Thazi', 'C', 5500, 4950, 1800),
(111, 'MDY', 'Mandalay', 'Yangon', 'Madaya', 'C', 5500, 4950, 1800),
(112, 'MDY', 'Mandalay', 'Yangon', 'Myitthar', 'B', 5000, 4500, 1800),
(113, 'MDY', 'Mandalay', 'Yangon', 'Paukkaung', 'B', 5000, 4500, 1800),
(114, 'MDY', 'Mandalay', 'Yangon', 'Ohn Chaw', 'B', 5000, 4500, 1800),
(115, 'MDY', 'Mandalay', 'Yangon', 'Taungtha', 'C', 5500, 4950, 1800),
(116, 'MDY', 'Mandalay', 'Yangon', 'Anesakhan', 'B', 5000, 4500, 1800),
(117, 'MDY', 'Mandalay', 'Yangon', 'Amarapura', 'B', 5000, 4500, 1800),
(118, 'MDY', 'Mandalay', 'Yangon', 'Myintnge', 'B', 5000, 4500, 1800),
(119, 'MDY', 'Mandalay', 'Yangon', 'Natoegyi', 'C', 5500, 4950, 1800),
(120, 'MDY', 'Mandalay', 'Yangon', 'Han Myint Mo', 'B', 5000, 4500, 1800),
(121, 'MDY', 'Mandalay', 'Yangon', 'Tada-U', 'B', 5000, 4500, 1800),
(122, 'MDY', 'Mandalay', 'Yangon', 'Zeepingyi', 'B', 5000, 4500, 1800),
(123, 'MDY', 'Mandalay', 'Yangon', 'Patheingyi', 'B', 5000, 4500, 1800),
(124, 'MDY', 'Mandalay', 'Yangon', 'Padaung', 'B', 5000, 4500, 1800),
(125, 'MDY', 'Mandalay', 'Yangon', 'Palaik', 'B', 5000, 4500, 1800),
(126, 'MDY', 'Mandalay', 'Yangon', 'Pyinyaung', 'C', 5500, 4950, 1800),
(127, 'MDY', 'Mandalay', 'Yangon', 'Mogok', 'E', 7000, 6300, 2250),
(128, 'MGY', 'Magway', 'Yangon', 'Aunglan', 'B', 5000, 4500, 1800),
(129, 'MGY', 'Magway', 'Yangon', 'Chauk', 'B', 5000, 4500, 1800),
(130, 'MGY', 'Magway', 'Yangon', 'Magway', 'B', 5000, 4500, 1800),
(131, 'MGY', 'Magway', 'Yangon', 'Minbu', 'B', 5000, 4500, 1800),
(132, 'MGY', 'Magway', 'Yangon', 'Pakokku', 'B', 5000, 4500, 1800),
(133, 'MGY', 'Magway', 'Yangon', 'Yesagyo', 'B', 5000, 4500, 1800),
(134, 'MGY', 'Magway', 'Yangon', 'Taungdwingyi', 'B', 5000, 4500, 1800),
(135, 'MGY', 'Magway', 'Yangon', 'Thayed', 'B', 5000, 4500, 1800),
(136, 'MGY', 'Magway', 'Yangon', 'Yenanchaung', 'B', 5000, 4500, 1800),
(137, 'MGY', 'Magway', 'Yangon', 'Pwintbyu', 'B', 5000, 4500, 1800),
(138, 'MGY', 'Magway', 'Yangon', 'NatMauk', 'B', 5000, 4500, 1800),
(139, 'MGY', 'Magway', 'Yangon', 'Salin', 'B', 5000, 4500, 1800),
(140, 'MGY', 'Magway', 'Yangon', 'SinHpyuKyun', 'B', 5000, 4500, 1800),
(141, 'MGY', 'Magway', 'Yangon', 'Satthwar', 'B', 5000, 4500, 1800),
(142, 'MGY', 'Magway', 'Yangon', 'Myothit', 'B', 5000, 4500, 1800),
(143, 'MGY', 'Magway', 'Yangon', 'Kamma', 'B', 5000, 4500, 1800),
(144, 'MGY', 'Magway', 'Yangon', 'Mindone', 'B', 5000, 4500, 1800),
(145, 'MGY', 'Magway', 'Yangon', 'Ngape', 'B', 5000, 4500, 1800),
(146, 'MGY', 'Magway', 'Yangon', 'Upper Minhla', 'B', 5000, 4500, 1800),
(147, 'MGY', 'Magway', 'Yangon', 'Saku', 'B', 5000, 4500, 1800),
(148, 'MGY', 'Magway', 'Yangon', 'Salay', 'B', 5000, 4500, 1800),
(149, 'MGY', 'Magway', 'Yangon', 'Seik Phyu', 'B', 5000, 4500, 1800),
(150, 'MGY', 'Magway', 'Yangon', 'Kamma (Pakokku)', 'B', 5000, 4500, 1800),
(151, 'MGY', 'Magway', 'Yangon', 'SinBaungWe', 'B', 5000, 4500, 1800),
(152, 'MGY', 'Magway', 'Yangon', 'ThitYarGyauk', 'B', 5000, 4500, 1800),
(153, 'MON', 'Mon', 'Yangon', 'Mawlamyine', 'A', 4500, 4050, 1800),
(154, 'MON', 'Mon', 'Yangon', 'Bilin', 'A', 4500, 4050, 1800),
(155, 'MON', 'Mon', 'Yangon', 'Mudon', 'B', 5000, 4500, 1800),
(156, 'MON', 'Mon', 'Yangon', 'Thaton', 'A', 4500, 4050, 1800),
(157, 'MON', 'Mon', 'Yangon', 'Ye', 'B', 5000, 4500, 1800),
(158, 'MON', 'Mon', 'Yangon', 'Thanbyuzayat', 'B', 5000, 4500, 1800),
(159, 'MON', 'Mon', 'Yangon', 'Kyaikto', 'A', 4500, 4050, 1800),
(160, 'MON', 'Mon', 'Yangon', 'Paung', 'A', 4500, 4050, 1800),
(161, 'MON', 'Mon', 'Yangon', 'Mottama', 'A', 4500, 4050, 1800),
(162, 'MON', 'Mon', 'Yangon', 'Kyaikmaraw', 'B', 5000, 4500, 1800),
(163, 'MON', 'Mon', 'Yangon', 'Kyaikkhami', 'B', 5000, 4500, 1800),
(164, 'MON', 'Mon', 'Yangon', 'Kyaikkaw', 'A', 4500, 4050, 1800),
(165, 'MON', 'Mon', 'Yangon', 'Chaungzone', 'B', 5000, 4500, 1800),
(166, 'MON', 'Mon', 'Yangon', 'Thein Za Yat', 'B', 5000, 4500, 1800),
(167, 'MON', 'Mon', 'Yangon', 'ZinKyaik', 'A', 4500, 4050, 1800),
(168, 'NPW', 'Naypyidaw', 'Yangon', 'Naypyidaw', 'A', 4500, 4050, 1800),
(169, 'NPW', 'Naypyidaw', 'Yangon', 'Tatkon', 'A', 4500, 4050, 1800),
(170, 'NPW', 'Naypyidaw', 'Yangon', 'Tharwuthti', 'A', 4500, 4050, 1800),
(171, 'NPW', 'Naypyidaw', 'Yangon', 'Zeyawaddy', 'A', 4500, 4050, 1800),
(172, 'RKE', 'Rakhine', 'Yangon', 'Sittwe', 'E', 7000, 6300, 2250),
(173, 'RKE', 'Rakhine', 'Yangon', 'Toungup', 'E', 7000, 6300, 2250),
(174, 'RKE', 'Rakhine', 'Yangon', 'Thandwe', 'E', 7000, 6300, 2250),
(175, 'RKE', 'Rakhine', 'Yangon', 'Kyaukpyu', 'E', 7000, 6300, 2250),
(176, 'RKE', 'Rakhine', 'Yangon', 'Min Pyar', 'E', 7000, 6300, 2250),
(177, 'RKE', 'Rakhine', 'Yangon', 'Ann', 'E', 7000, 6300, 2250),
(178, 'RKE', 'Rakhine', 'Yangon', 'Kyauktaw', 'E', 7000, 6300, 2250),
(179, 'RKE', 'Rakhine', 'Yangon', 'Mrauk-U', 'E', 7000, 6300, 2250),
(180, 'RKE', 'Rakhine', 'Yangon', 'Ramree', 'E', 7000, 6300, 2250),
(181, 'SGG', 'Sagaing', 'Yangon', 'Kalay', 'D', 6000, 5400, 1800),
(182, 'SGG', 'Sagaing', 'Yangon', 'Monywa', 'C', 5500, 4950, 1800),
(183, 'SGG', 'Sagaing', 'Yangon', 'Sagaing', 'B', 5000, 4500, 1800),
(184, 'SGG', 'Sagaing', 'Yangon', 'Shwebo', 'C', 5500, 4950, 1800),
(185, 'SGG', 'Sagaing', 'Yangon', 'Tamu', 'D', 6000, 5400, 1800),
(186, 'SGG', 'Sagaing', 'Yangon', 'Katha', 'D', 6000, 5400, 1800),
(187, 'SGG', 'Sagaing', 'Yangon', 'Kawlin', 'E', 7000, 6300, 2250),
(188, 'SGG', 'Sagaing', 'Yangon', 'Tigyaing', 'D', 6000, 5400, 1800),
(189, 'SGG', 'Sagaing', 'Yangon', 'Myinmu', 'C', 5500, 4950, 1800),
(190, 'SGG', 'Sagaing', 'Yangon', 'Seikkhun', 'C', 5500, 4950, 1800),
(191, 'SGG', 'Sagaing', 'Yangon', 'Indaw', 'E', 7000, 6300, 2250),
(192, 'SHAN', 'Shan', 'Yangon', 'Aungpan', 'B', 5000, 4500, 1800),
(193, 'SHAN', 'Shan', 'Yangon', 'Kalaw', 'B', 5000, 4500, 1800),
(194, 'SHAN', 'Shan', 'Yangon', 'Lashio', 'E', 7000, 6300, 2250),
(195, 'SHAN', 'Shan', 'Yangon', 'Kyaukme', 'D', 6000, 5400, 1800),
(196, 'SHAN', 'Shan', 'Yangon', 'Hsipaw', 'D', 6000, 5400, 1800),
(197, 'SHAN', 'Shan', 'Yangon', 'Muse', 'E', 7000, 6300, 2250),
(198, 'SHAN', 'Shan', 'Yangon', 'Taunggyi', 'B', 5000, 4500, 1800),
(199, 'SHAN', 'Shan', 'Yangon', 'Yatsauk', 'C', 5500, 4950, 1800),
(200, 'SHAN', 'Shan', 'Yangon', 'Pinlaung', 'C', 5500, 4950, 1800),
(201, 'SHAN', 'Shan', 'Yangon', 'Kengtung', 'J', 10500, 9450, 2700),
(202, 'SHAN', 'Shan', 'Yangon', 'Tachileik', 'J', 10500, 9450, 2700),
(203, 'SHAN', 'Shan', 'Yangon', 'Nyaungshwe', 'C', 5500, 4950, 1800),
(204, 'SHAN', 'Shan', 'Yangon', 'Ayetharyar', 'B', 5000, 4500, 1800),
(205, 'SHAN', 'Shan', 'Yangon', 'Hopong', 'C', 5500, 4950, 1800),
(206, 'SHAN', 'Shan', 'Yangon', 'Pindaya', 'C', 5500, 4950, 1800),
(207, 'SHAN', 'Shan', 'Yangon', 'Loilem', 'C', 5500, 4950, 1800),
(208, 'SHAN', 'Shan', 'Yangon', 'HeHoe', 'B', 5000, 4500, 1800),
(209, 'SHAN', 'Shan', 'Yangon', 'Ywangan', 'C', 5500, 4950, 1800),
(210, 'SHAN', 'Shan', 'Yangon', 'Namhkam', 'D', 6000, 5400, 1800),
(211, 'SHAN', 'Shan', 'Yangon', 'Namtu', 'D', 6000, 5400, 1800),
(212, 'SHAN', 'Shan', 'Yangon', 'Kutkai', 'D', 6000, 5400, 1800),
(213, 'SHAN', 'Shan', 'Yangon', 'Shwenyaung', 'B', 5000, 4500, 1800),
(214, 'SHAN', 'Shan', 'Yangon', 'Nawnghkio', 'E', 7000, 6300, 2250),
(215, 'TNT', 'Tanintharyi', 'Yangon', 'Dawei', 'E', 7000, 6300, 2250),
(216, 'TNT', 'Tanintharyi', 'Yangon', 'Myeik', 'F', 8000, 7200, 2250),
(217, 'TNT', 'Tanintharyi', 'Yangon', 'Kawthoung', 'I', 10000, 9000, 2700),
(218, 'YGN', 'Yangon', 'Yangon', 'Yangon', '0', 4000, 3400, 1700),
(219, 'YGN', 'Yangon', 'Yangon', 'Hlegu', 'A', 4500, 4050, 1800),
(220, 'YGN', 'Yangon', 'Yangon', 'Thongwa', 'A', 4500, 4050, 1800),
(221, 'YGN', 'Yangon', 'Yangon', 'Hmawbi', 'A', 4500, 4050, 1800),
(222, 'YGN', 'Yangon', 'Yangon', 'Taikkyi', 'A', 4500, 4050, 1800),
(223, 'YGN', 'Yangon', 'Yangon', 'Twantay', 'A', 4500, 4050, 1800),
(224, 'YGN', 'Yangon', 'Yangon', 'Kyauktan', 'A', 4500, 4050, 1800),
(225, 'YGN', 'Yangon', 'Yangon', 'Kungyangone', 'A', 4500, 4050, 1800),
(226, 'YGN', 'Yangon', 'Yangon', 'Ahpyauk', 'A', 4500, 4050, 1800),
(227, 'YGN', 'Yangon', 'Yangon', 'Kawhmu', 'A', 4500, 4050, 1800)
ON CONFLICT (sr_no) DO UPDATE SET
  state_code = EXCLUDED.state_code,
  state_name = EXCLUDED.state_name,
  from_city = EXCLUDED.from_city,
  to_city = EXCLUDED.to_city,
  zone = EXCLUDED.zone,
  normal_price = EXCLUDED.normal_price,
  courier_cost = EXCLUDED.courier_cost,
  next_kg_rate = EXCLUDED.next_kg_rate;

-- Orders enhancements for Deposit + COD
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source varchar(40) NOT NULL DEFAULT 'web';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS destination_id uuid REFERENCES shipping_destinations(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS destination_city varchar(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS destination_state varchar(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS street_address text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_digital_only boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packed_weight_kg numeric(8,2) NOT NULL DEFAULT 1.00;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expected_courier_cost numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_courier_cost numeric(14,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS required_deposit numeric(14,2) NOT NULL DEFAULT 10000;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_paid_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_balance numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_payment_status varchar(40) NOT NULL DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_settlement_status varchar(40) NOT NULL DEFAULT 'not_applicable';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commercial_frozen boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS internal_notes text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_cost numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_reason text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS failed_delivery_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_customer_payment_status_idx ON orders(customer_payment_status);
CREATE INDEX IF NOT EXISTS orders_courier_settlement_status_idx ON orders(courier_settlement_status);

-- Immutable order payments ledger
CREATE TABLE IF NOT EXISTS order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_type varchar(40) NOT NULL,
  amount numeric(14,2) NOT NULL,
  payment_method varchar(40) NOT NULL DEFAULT 'kbzpay',
  status varchar(40) NOT NULL DEFAULT 'pending',
  reference varchar(120),
  slip_url text,
  recorded_by varchar(120) NOT NULL DEFAULT 'customer',
  verified_by varchar(120),
  verified_at timestamptz,
  reversal_of_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_payments_order_id_idx ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS order_payments_status_idx ON order_payments(status);
CREATE INDEX IF NOT EXISTS order_payments_type_idx ON order_payments(payment_type);

-- Courier Settlement Batches
CREATE TABLE IF NOT EXISTS courier_settlement_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code varchar(60) UNIQUE NOT NULL,
  courier_name varchar(80) NOT NULL DEFAULT 'Royal Express',
  bank_account varchar(120) NOT NULL,
  transfer_reference varchar(120) NOT NULL,
  settlement_date timestamptz NOT NULL,
  total_collected numeric(14,2) NOT NULL DEFAULT 0,
  total_courier_fees numeric(14,2) NOT NULL DEFAULT 0,
  other_fees numeric(14,2) NOT NULL DEFAULT 0,
  bank_received_amount numeric(14,2) NOT NULL CHECK(bank_received_amount >= 0),
  status varchar(40) NOT NULL DEFAULT 'completed',
  discrepancy_amount numeric(14,2) NOT NULL DEFAULT 0,
  recorded_by varchar(120) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS courier_settlements_date_idx ON courier_settlement_batches(settlement_date);
CREATE INDEX IF NOT EXISTS courier_settlements_status_idx ON courier_settlement_batches(status);

-- Courier Settlement Allocations
CREATE TABLE IF NOT EXISTS courier_settlement_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_batch_id uuid NOT NULL REFERENCES courier_settlement_batches(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  expected_cod numeric(14,2) NOT NULL,
  allocated_collected numeric(14,2) NOT NULL,
  expected_courier_fee numeric(14,2) NOT NULL,
  allocated_courier_fee numeric(14,2) NOT NULL,
  net_order_payout numeric(14,2) NOT NULL,
  allocated_by varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS courier_allocations_batch_idx ON courier_settlement_allocations(settlement_batch_id);
CREATE INDEX IF NOT EXISTS courier_allocations_order_idx ON courier_settlement_allocations(order_id);

-- Backfill legacy verified orders as fully paid prepayment records
UPDATE orders SET
  customer_paid_amount = total_amount,
  customer_balance = 0,
  customer_payment_status = 'fully_paid',
  required_deposit = total_amount,
  cod_amount = 0,
  delivery_fee_confirmed = true,
  commercial_frozen = (fulfillment_status IN ('dispatched', 'delivered')),
  courier_settlement_status = 'not_applicable'
WHERE payment_status = 'verified' AND (customer_paid_amount = 0 OR customer_paid_amount IS NULL);

-- Backfill legacy pending orders with standard deposit requirements
UPDATE orders SET
  customer_paid_amount = 0,
  customer_balance = total_amount,
  customer_payment_status = 'unpaid',
  required_deposit = LEAST(10000, total_amount),
  cod_amount = GREATEST(0, total_amount - LEAST(10000, total_amount)),
  courier_settlement_status = 'unsettled'
WHERE payment_status = 'pending' AND (customer_balance = 0 OR customer_balance IS NULL);

-- Insert payment ledger entries for legacy verified orders if none exist
INSERT INTO order_payments (order_id, payment_type, amount, payment_method, status, recorded_by, verified_by, verified_at, notes, created_at)
SELECT id, 'direct_prepayment', total_amount, COALESCE(payment_method, 'legacy'), 'verified', 'system', 'legacy_backfill', created_at, 'Legacy verified order backfill', created_at
FROM orders o
WHERE o.payment_status = 'verified' AND NOT EXISTS (
  SELECT 1 FROM order_payments op WHERE op.order_id = o.id
);
