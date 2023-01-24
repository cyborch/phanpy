import { getCurrentAccount } from './store-utils';

export default async function translateStatus(status) {
  const { instanceURL, accessToken } = getCurrentAccount();
  console.log({ instanceURL, accessToken });

  const translateResponse = await fetch(
    `https://${instanceURL}/api/v1/statuses/${status.id}/translate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    },
  );
  const translateJSON = await translateResponse.json();
  console.log({ translateJSON });
  return translateJSON;
}
