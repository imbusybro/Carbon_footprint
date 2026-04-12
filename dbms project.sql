create database carbon_db;
use carbon_db;

show tables;
desc raw_energy_data;
desc country_continent_region_mapping_enriched;

select count(*) from raw_energy_data;
select * from raw_energy_data limit 5;

create table continent (
continent_id int auto_increment primary key,
continent_name varchar(50) unique not null);

insert into continent (continent_name)
select distinct continent
from country_continent_region_mapping_enriched
where continent is not null;
select * from continent;

create table country (
country_id int auto_increment primary key,
country_name varchar (100) not null,
iso_code varchar (20),
continent_id int,
foreign key (continent_id) references continent (continent_id));

insert into country (country_name, iso_code) 
select distinct country, iso_code
from raw_energy_data
where country is not null;

update country c 
join country_continent_region_mapping_enriched m
on c.country_name = m.country
join continent ct
on m.continent = ct.continent_name
set c.continent_id = ct.continent_id;

select c.country_name, ct.continent_name
from country c
left join continent ct 
on c.continent_id = ct.continent_id 
limit 20;

update country set country_name = lower(trim(country_name));
update country_continent_region_mapping set country = lower(trim(country));
update continent set continent_name = lower(trim(continent_name));

select * from country;

create table year_dim(
year_id int auto_increment primary key,
year int unique not null,
decade int);

insert into year_dim (year, decade)
select distinct year, (year div 10) * 10
from raw_energy_data 
where year is not null;
select * from year_dim;

create table energy_source (
source_id int auto_increment primary key,
source_name varchar (50) not null,
type varchar (20) check (type in ('fossil','renewable')) );

insert into energy_source (source_name, type ) values 
('coal', 'fossil'),
('oil', 'fossil'),
('gas', 'fossil'),
('solar', 'renewable'),
('wind', 'renewable'),
('hydro', 'renewable');

select * from energy_source;

create table region (
region_id int auto_increment primary key,
region_name varchar (100) not null);

insert into region (region_name)
select distinct region 
from country_continent_region_mapping
where region is not null;
select * from region;

create table country_region_map (
id int auto_increment primary key,
country_id int,
region_id int,
foreign key (country_id) references country(country_id),
foreign key (region_id) references region(region_id));

insert into country_region_map (country_id, region_id)
select c.country_id, r.region_id
from country c
join country_continent_region_mapping m 
on c.country_name = m.country
join region r 
on m.region = r.region_name;
select * from country_region_map;

create table emissions (
emission_id int auto_increment primary key,
country_id int,
year_id int,
coal double,
oil double,
gas double,
foreign key (country_id) references country(country_id),
foreign key (year_id) references year_dim(year_id));
alter table emissions
add total_emissions double generated always as (coal + oil + gas) stored;

insert into emissions (country_id, year_id, coal, oil, gas)
select 
c.country_id,
y.year_id,
r.coal,
r.oil,
r.gas
from raw_energy_data r
join country c 
on lower(trim(r.country)) = c.country_name
join year_dim y 
on r.year = y.year;
select * from emissions;

create table emissions_new (
emission_id int auto_increment primary key,
country_id int not null,
year_id int not null,
source_id int not null,
emission_amount double,

foreign key (country_id) references country(country_id),
foreign key (year_id) references year_dim(year_id),
foreign key (source_id) references energy_source(source_id),

unique (country_id, year_id, source_id));

insert into emissions_new (country_id, year_id, source_id, emission_amount)
select 
e.country_id,
e.year_id,
s.source_id,
e.coal
from emissions e
join energy_source s 
on s.source_name = 'coal'
where e.coal is not null;

insert into emissions_new (country_id, year_id, source_id, emission_amount)
select 
e.country_id,
e.year_id,
s.source_id,
e.oil
from emissions e
join energy_source s 
on s.source_name = 'oil'
where e.oil is not null;

insert into emissions_new (country_id, year_id, source_id, emission_amount)
select 
e.country_id,
e.year_id,
s.source_id,
e.gas
from emissions e
join energy_source s 
on s.source_name = 'gas'
where e.gas is not null;
select * from emissions_new;

rename table emissions to emissions_old;
rename table emissions_new to emissions;
drop table emissions_old;

create table gdp_data (
gdp_id int auto_increment primary key,
country_id int,
year_id int,
gdp double,
gdp_per_capita double,
foreign key (country_id) references country(country_id),
foreign key (year_id) references year_dim(year_id));

insert into gdp_data (country_id, year_id, gdp, gdp_per_capita)
select 
c.country_id,
y.year_id,
r.gdp,
r.gdp_per_capita
from raw_energy_data r
join country c 
on lower(trim(r.country)) = c.country_name
join year_dim y 
on r.year = y.year
where r.gdp is not null;
select * from gdp_data;

create table energy_consumption (
consumption_id int auto_increment primary key,
country_id int,
year_id int,
total_energy double,
foreign key (country_id) references country(country_id),
foreign key (year_id) references year_dim(year_id));

insert into energy_consumption (country_id, year_id, total_energy)
select 
c.country_id,
y.year_id,
r.energy_consumption
from raw_energy_data r
join country c 
on lower(trim(r.country)) = c.country_name
join year_dim y 
on r.year = y.year
where r.energy_consumption is not null;
select * from energy_consumption;

create table population_data (
pop_id int auto_increment primary key,
country_id int,
year_id int,
population bigint,
foreign key (country_id) references country(country_id),
foreign key (year_id) references year_dim(year_id));

insert into population_data (country_id, year_id, population)
select 
c.country_id,
y.year_id,
r.population
from raw_energy_data r
join country c 
on lower(trim(r.country)) = c.country_name
join year_dim y 
on r.year = y.year
where r.population is not null;
select * from population_data;

create table energy_breakdown (
breakdown_id int auto_increment primary key,
country_id int,
year_id int,
source_id int,
energy_amount double,
foreign key (country_id) references country(country_id),
foreign key (year_id) references year_dim(year_id),
foreign key (source_id) references energy_source(source_id));

alter table energy_breakdown
add constraint chk_energy_amount 
check (energy_amount >= 0);

create view energy_share as
select 
country_id,
year_id,
sum(case when es.type = 'renewable' then eb.energy_amount else 0 end) as renewable_energy,
sum(case when es.type = 'fossil' then eb.energy_amount else 0 end) as fossil_energy
from energy_breakdown eb
join energy_source es 
on eb.source_id = es.source_id
group by country_id, year_id;

select distinct y.year
from emissions e
join year_dim y on e.year_id = y.year_id
where e.emission_amount is not null
order by y.year;

create view kpi_metrics as
select 
f.country_id,
f.year_id,
f.total_emissions / p.population as co2_per_capita,
f.total_emissions / nullif(g.gdp, 0) as emission_intensity
from fact_country_year f
left join population_data p 
on f.country_id = p.country_id and f.year_id = p.year_id
left join gdp_data g 
on f.country_id = g.country_id and f.year_id = g.year_id;

select * from kpi_metrics;