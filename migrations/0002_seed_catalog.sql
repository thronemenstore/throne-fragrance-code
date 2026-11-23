INSERT OR IGNORE INTO products (slug,name,family,notes,blurb,description,price,stock,image_key,sort_order) VALUES
('glory','Glory','Woody','Cedar, amber, musk','A confident woody signature.','A polished woody scent with warm depth.',2199,20,'glory',1),
('midnight','Midnight Crown','Oriental','Spice, woods, vanilla','A bold evening statement.','A rich oriental fragrance made for after dark.',1799,20,'midnight-crown',2),
('velora','Velora','Floral','Rose, white musk, vanilla','Soft, luminous and unforgettable.','A modern floral with a smooth finish.',1999,20,'velora',3);
INSERT OR IGNORE INTO settings (key,value) VALUES
('announcement','Complimentary shipping on orders over Rs. 5,000 · Cash on delivery available · Authentic parfum, sealed'),
('free_ship_threshold','5000'),('promo_code','THRONE10'),('promo_percent','10'),('promo_enabled','1'),('bundle_enabled','1'),('bundle_discount_percent','20');
INSERT OR IGNORE INTO shipping_methods (name,eta,fee,free_over,is_active,sort_order) VALUES
('Standard Delivery','3–5 business days',300,5000,1,1),('Express Delivery','1–2 business days',499,NULL,1,2),('Local Delivery','Same or next day',150,5000,1,3);
