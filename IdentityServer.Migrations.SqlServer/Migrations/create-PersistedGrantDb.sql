IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
CREATE TABLE [DeviceCodes] (
    [UserCode] nvarchar(200) NOT NULL,
    [DeviceCode] nvarchar(200) NOT NULL,
    [SubjectId] nvarchar(200) NULL,
    [SessionId] nvarchar(100) NULL,
    [ClientId] nvarchar(200) NOT NULL,
    [Description] nvarchar(200) NULL,
    [CreationTime] datetime2 NOT NULL,
    [Expiration] datetime2 NOT NULL,
    [Data] nvarchar(max) NOT NULL,
    CONSTRAINT [PK_DeviceCodes] PRIMARY KEY ([UserCode])
);

CREATE TABLE [Keys] (
    [Id] nvarchar(450) NOT NULL,
    [Version] int NOT NULL,
    [Created] datetime2 NOT NULL,
    [Use] nvarchar(450) NULL,
    [Algorithm] nvarchar(100) NOT NULL,
    [IsX509Certificate] bit NOT NULL,
    [DataProtected] bit NOT NULL,
    [Data] nvarchar(max) NOT NULL,
    CONSTRAINT [PK_Keys] PRIMARY KEY ([Id])
);

CREATE TABLE [PersistedGrants] (
    [Id] bigint NOT NULL IDENTITY,
    [Key] nvarchar(200) NULL,
    [Type] nvarchar(50) NOT NULL,
    [SubjectId] nvarchar(200) NULL,
    [SessionId] nvarchar(100) NULL,
    [ClientId] nvarchar(200) NOT NULL,
    [Description] nvarchar(200) NULL,
    [CreationTime] datetime2 NOT NULL,
    [Expiration] datetime2 NULL,
    [ConsumedTime] datetime2 NULL,
    [Data] nvarchar(max) NOT NULL,
    CONSTRAINT [PK_PersistedGrants] PRIMARY KEY ([Id])
);

CREATE TABLE [ServerSideSessions] (
    [Id] int NOT NULL IDENTITY,
    [Key] nvarchar(100) NOT NULL,
    [Scheme] nvarchar(100) NOT NULL,
    [SubjectId] nvarchar(100) NOT NULL,
    [SessionId] nvarchar(100) NULL,
    [DisplayName] nvarchar(100) NULL,
    [Created] datetime2 NOT NULL,
    [Renewed] datetime2 NOT NULL,
    [Expires] datetime2 NULL,
    [Data] nvarchar(max) NOT NULL,
    CONSTRAINT [PK_ServerSideSessions] PRIMARY KEY ([Id])
);

CREATE UNIQUE INDEX [IX_DeviceCodes_DeviceCode] ON [DeviceCodes] ([DeviceCode]);

CREATE INDEX [IX_DeviceCodes_Expiration] ON [DeviceCodes] ([Expiration]);

CREATE INDEX [IX_Keys_Use] ON [Keys] ([Use]);

CREATE INDEX [IX_PersistedGrants_ConsumedTime] ON [PersistedGrants] ([ConsumedTime]);

CREATE INDEX [IX_PersistedGrants_Expiration] ON [PersistedGrants] ([Expiration]);

CREATE UNIQUE INDEX [IX_PersistedGrants_Key] ON [PersistedGrants] ([Key]) WHERE [Key] IS NOT NULL;

CREATE INDEX [IX_PersistedGrants_SubjectId_ClientId_Type] ON [PersistedGrants] ([SubjectId], [ClientId], [Type]);

CREATE INDEX [IX_PersistedGrants_SubjectId_SessionId_Type] ON [PersistedGrants] ([SubjectId], [SessionId], [Type]);

CREATE INDEX [IX_ServerSideSessions_DisplayName] ON [ServerSideSessions] ([DisplayName]);

CREATE INDEX [IX_ServerSideSessions_Expires] ON [ServerSideSessions] ([Expires]);

CREATE UNIQUE INDEX [IX_ServerSideSessions_Key] ON [ServerSideSessions] ([Key]);

CREATE INDEX [IX_ServerSideSessions_SessionId] ON [ServerSideSessions] ([SessionId]);

CREATE INDEX [IX_ServerSideSessions_SubjectId] ON [ServerSideSessions] ([SubjectId]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20240112011437_InitialInitialIdentityServerPersistedGrantDbMigration', N'10.0.11');

COMMIT;
GO

BEGIN TRANSACTION;
ALTER TABLE [ServerSideSessions] DROP CONSTRAINT [PK_ServerSideSessions];

DECLARE @var nvarchar(max);
SELECT @var = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ServerSideSessions]') AND [c].[name] = N'Id');
IF @var IS NOT NULL EXEC(N'ALTER TABLE [ServerSideSessions] DROP CONSTRAINT ' + @var + ';');
ALTER TABLE [ServerSideSessions] ALTER COLUMN [Id] bigint NOT NULL;

ALTER TABLE [ServerSideSessions] ADD CONSTRAINT [PK_ServerSideSessions] PRIMARY KEY ([Id]);

CREATE TABLE [PushedAuthorizationRequests] (
    [Id] bigint NOT NULL IDENTITY,
    [ReferenceValueHash] nvarchar(64) NOT NULL,
    [ExpiresAtUtc] datetime2 NOT NULL,
    [Parameters] nvarchar(max) NOT NULL,
    CONSTRAINT [PK_PushedAuthorizationRequests] PRIMARY KEY ([Id])
);

CREATE INDEX [IX_PushedAuthorizationRequests_ExpiresAtUtc] ON [PushedAuthorizationRequests] ([ExpiresAtUtc]);

CREATE UNIQUE INDEX [IX_PushedAuthorizationRequests_ReferenceValueHash] ON [PushedAuthorizationRequests] ([ReferenceValueHash]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20240206182419_Update_Duende_v7_0InitialIdentityServerPersistedGrantDbMigration', N'10.0.11');

COMMIT;
GO

BEGIN TRANSACTION;
CREATE TABLE [SamlLogoutSessions] (
    [Id] bigint NOT NULL IDENTITY,
    [LogoutId] nvarchar(200) NOT NULL,
    [SerializedSession] nvarchar(max) NOT NULL,
    [ExpiresAtUtc] datetime2 NOT NULL,
    [Version] bigint NOT NULL,
    CONSTRAINT [PK_SamlLogoutSessions] PRIMARY KEY ([Id])
);

CREATE TABLE [SamlSigninStates] (
    [Id] bigint NOT NULL IDENTITY,
    [StateId] uniqueidentifier NOT NULL,
    [SerializedState] nvarchar(max) NOT NULL,
    [ExpiresAtUtc] datetime2 NOT NULL,
    [ServiceProviderEntityId] nvarchar(200) NOT NULL,
    CONSTRAINT [PK_SamlSigninStates] PRIMARY KEY ([Id])
);

CREATE TABLE [SamlLogoutSessionRequestIndices] (
    [Id] bigint NOT NULL IDENTITY,
    [RequestId] nvarchar(200) NOT NULL,
    [SamlLogoutSessionId] bigint NOT NULL,
    CONSTRAINT [PK_SamlLogoutSessionRequestIndices] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_SamlLogoutSessionRequestIndices_SamlLogoutSessions_SamlLogoutSessionId] FOREIGN KEY ([SamlLogoutSessionId]) REFERENCES [SamlLogoutSessions] ([Id]) ON DELETE CASCADE
);

CREATE UNIQUE INDEX [IX_SamlLogoutSessionRequestIndices_RequestId] ON [SamlLogoutSessionRequestIndices] ([RequestId]);

CREATE INDEX [IX_SamlLogoutSessionRequestIndices_SamlLogoutSessionId] ON [SamlLogoutSessionRequestIndices] ([SamlLogoutSessionId]);

CREATE INDEX [IX_SamlLogoutSessions_ExpiresAtUtc] ON [SamlLogoutSessions] ([ExpiresAtUtc]);

CREATE UNIQUE INDEX [IX_SamlLogoutSessions_LogoutId] ON [SamlLogoutSessions] ([LogoutId]);

CREATE INDEX [IX_SamlSigninStates_ExpiresAtUtc] ON [SamlSigninStates] ([ExpiresAtUtc]);

CREATE UNIQUE INDEX [IX_SamlSigninStates_StateId] ON [SamlSigninStates] ([StateId]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260820162815_Update_Duende_v8_0InitialIdentityServerPersistedGrantDbMigration', N'10.0.11');

COMMIT;
GO

