# Seeding Data

When the `AppConfig__SeedData` configuration option is set to `true`, the server will seed the database with initial data.  This includes running the database migrations found in the included migration projects (such as `IdentityServer.Migrations.Sqlite`).

The server will add any trust anchor certificates found in the `CertStore` directory to the initial database.  It will create a community for each directory found in the `CertStore` directory where the community name will match the directory name.  It will add a trust anchor to the community using any `.cer` or `.crt` file found in the directory.

Anchors can also be seeded by adding them to the `AppConfig__Anchors` configuration option.  This is a list of anchor files and a community name.  The anchor file property can be either a file path or a base64 encoded string.

```json
{
  "AppConfig": {
    ...
    "Anchors": [
      {
        "AnchorFile": "/path/to/anchor.crt",
        "Community": "MyTrustCommunity1"
      },
      {
        "AnchorFile": "base64 encoded string of anchorfile",
        "Community": "MyTrustCommunity2"
      }
    ]
    ...
  }
}
```
