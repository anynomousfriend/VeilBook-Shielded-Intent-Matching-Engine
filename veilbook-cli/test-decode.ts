try {
  console.log('Starting script...');
  const { MidnightBech32m, UnshieldedAddress } = await import('@midnight-ntwrk/wallet-sdk-address-format');
  const { getNetworkId, setNetworkId } = await import('@midnight-ntwrk/midnight-js-network-id');
  
  setNetworkId('preprod');
  const bech32Str = 'mn_addr_preprod1yx3vsmv28khe4rpnhxjlh06ljtnhq3xqajx332ky5ktu0satuvwsjnl5yx';
  
  console.log('Parsing...');
  const parsed = MidnightBech32m.parse(bech32Str);
  console.log('Parsed successfully');
  
  console.log('Decoding...');
  const decoded = parsed.decode(UnshieldedAddress, 'preprod');
  console.log('Decoded successfully');
  
  console.log(decoded);
  console.log(decoded.toBytes().toString('hex'));
} catch (e) {
  console.error('CAUGHT:', e);
}
