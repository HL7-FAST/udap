@echo off

if [%1] == [] (
  echo Please provide a migration name
  exit /b 1
)


:: SQLite
dotnet ef migrations add %1ConfigurationDbMigration -c ConfigurationDbContext -p ../IdentityServer.Migrations.Sqlite -o ../IdentityServer.Migrations.Sqlite/Migrations/ConfigurationDb -- AppConfig:DatabaseProvider=Sqlite
dotnet ef migrations add %1IdentityServerPersistedGrantDbMigration -c PersistedGrantDbContext -p ../IdentityServer.Migrations.Sqlite -o ../IdentityServer.Migrations.Sqlite/Migrations/PersistedGrantDb -- AppConfig:DatabaseProvider=Sqlite
dotnet ef migrations add %1IdentityServerUdapDbMigration -c UdapDbContext -p ../IdentityServer.Migrations.Sqlite -o ../IdentityServer.Migrations.Sqlite/Migrations/UdapDb -- AppConfig:DatabaseProvider=Sqlite
dotnet ef migrations script -c ConfigurationDbContext -o ../IdentityServer.Migrations.Sqlite/Migrations/create-ConfigurationDb.sql -- AppConfig:DatabaseProvider=Sqlite
dotnet ef migrations script -c PersistedGrantDbContext -o ../IdentityServer.Migrations.Sqlite/Migrations/create-PersistedGrantDb.sql -- AppConfig:DatabaseProvider=Sqlite
dotnet ef migrations script -c UdapDbContext -o ../IdentityServer.Migrations.Sqlite/Migrations/create-UdapDb.sql -- AppConfig:DatabaseProvider=Sqlite

:: SQL Server
dotnet ef migrations add %1IdentityServerConfigurationDbMigration -c ConfigurationDbContext --project ../IdentityServer.Migrations.SqlServer -o ../IdentityServer.Migrations.SqlServer/Migrations/ConfigurationDb -- AppConfig:DatabaseProvider=SqlServer
dotnet ef migrations add %1InitialIdentityServerPersistedGrantDbMigration -c PersistedGrantDbContext --project ../IdentityServer.Migrations.SqlServer -o ../IdentityServer.Migrations.SqlServer/Migrations/PersistedGrantDb -- AppConfig:DatabaseProvider=SqlServer
dotnet ef migrations add %1InitialIdentityServerUdapDbMigration -c UdapDbContext --project ../IdentityServer.Migrations.SqlServer -o ../IdentityServer.Migrations.SqlServer/Migrations/UdapDb -- AppConfig:DatabaseProvider=SqlServer
dotnet ef migrations script -c ConfigurationDbContext -o ../IdentityServer.Migrations.SqlServer/Migrations/create-ConfigurationDb.sql -- AppConfig:DatabaseProvider=SqlServer
dotnet ef migrations script -c PersistedGrantDbContext -o ../IdentityServer.Migrations.SqlServer/Migrations/create-PersistedGrantDb.sql -- AppConfig:DatabaseProvider=SqlServer
dotnet ef migrations script -c UdapDbContext -o ../IdentityServer.Migrations.SqlServer/Migrations/create-UdapDb.sql -- AppConfig:DatabaseProvider=SqlServer


:: PostgreSQL
dotnet ef migrations add %1IdentityServerConfigurationDbMigration -c ConfigurationDbContext --project ../IdentityServer.Migrations.Pgsql -o ../IdentityServer.Migrations.Pgsql/Migrations/ConfigurationDb -- AppConfig:DatabaseProvider=Pgsql
dotnet ef migrations add %1InitialIdentityServerPersistedGrantDbMigration -c PersistedGrantDbContext --project ../IdentityServer.Migrations.Pgsql -o ../IdentityServer.Migrations.Pgsql/Migrations/PersistedGrantDb -- AppConfig:DatabaseProvider=Pgsql
dotnet ef migrations add %1InitialIdentityServerUdapDbMigration -c UdapDbContext --project ../IdentityServer.Migrations.Pgsql -o ../IdentityServer.Migrations.Pgsql/Migrations/UdapDb -- AppConfig:DatabaseProvider=Pgsql
dotnet ef migrations script -c ConfigurationDbContext -o ../IdentityServer.Migrations.Pgsql/Migrations/create-ConfigurationDb.sql -- AppConfig:DatabaseProvider=Pgsql
dotnet ef migrations script -c PersistedGrantDbContext -o ../IdentityServer.Migrations.Pgsql/Migrations/create-PersistedGrantDb.sql -- AppConfig:DatabaseProvider=Pgsql
dotnet ef migrations script -c UdapDbContext -o ../IdentityServer.Migrations.Pgsql/Migrations/create-UdapDb.sql -- AppConfig:DatabaseProvider=Pgsql
