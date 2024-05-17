﻿using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IdentityServer.Migrations.Pgsql.Migrations.ConfigurationDb
{
    /// <inheritdoc />
    public partial class Update_Duende_v7_0IdentityServerConfigurationDbMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PushedAuthorizationLifetime",
                table: "Clients",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequirePushedAuthorization",
                table: "Clients",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PushedAuthorizationLifetime",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "RequirePushedAuthorization",
                table: "Clients");
        }
    }
}