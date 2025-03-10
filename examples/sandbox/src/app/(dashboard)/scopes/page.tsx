"use client"

import { getServerCertificate } from '@/lib/cert-store';
import { getDefaultClient } from '@/lib/client-store';
import { UdapClient } from '@/lib/models';
import { Chip, Stack } from '@mui/material';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';


export default function OrdersPage() {

  const [client, setClient] = useState<UdapClient>();

  useEffect(() => {
    async function loadClient() {
      const client = await getDefaultClient();
      setClient(client);
    }
    loadClient();
  }, []);
  

  return (
    <>
      <Typography>
        Client scopes:
      </Typography>
      <Stack direction="row" spacing={1}>
        {client?.scopes.map((scope, i) => <Chip key={i} label={scope} size="small"/>)}
      </Stack>
    </>

  );
}
