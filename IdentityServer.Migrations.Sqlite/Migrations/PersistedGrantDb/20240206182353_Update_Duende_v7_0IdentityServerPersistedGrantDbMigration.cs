using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IdentityServer.Migrations.Sqlite.Migrations.PersistedGrantDb
{
    /// <inheritdoc />
    public partial class Update_Duende_v7_0IdentityServerPersistedGrantDbMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PushedAuthorizationRequests",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ReferenceValueHash = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Parameters = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PushedAuthorizationRequests", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PushedAuthorizationRequests_ExpiresAtUtc",
                table: "PushedAuthorizationRequests",
                column: "ExpiresAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_PushedAuthorizationRequests_ReferenceValueHash",
                table: "PushedAuthorizationRequests",
                column: "ReferenceValueHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PushedAuthorizationRequests");
        }
    }
}
