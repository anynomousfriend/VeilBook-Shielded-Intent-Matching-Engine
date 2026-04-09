import { MidnightBech32m, UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';

try {
  const bech32Str = 'mn_addr_preprod1yx3vsmv28khe4rpnhxjlh06ljtnhq3xqajx332ky5ktu0satuvwsjnl5yx';
  const parsed = MidnightBech32m.parse(bech32Str);
  const decoded = parsed.decode(UnshieldedAddress, 'preprod');
  
  console.log('Decoded address object:', decoded);
  console.log('Keys:', Object.keys(decoded));
  console.log('bytes:', decoded.bytes ? Buffer.from(decoded.bytes).toString('hex') : 'No bytes property');
  console.log('buffer:', decoded.buffer ? Buffer.from(decoded.buffer).toString('hex') : 'No buffer property');
} catch (e) {
  console.error(e);
}
