// ---------- КОНФИГУРАЦИЯ ----------
const CANDY_MACHINE_ID = '4Z4VH9UVMSEHqZJRqutQcAStkiBXFKeeSdbr2DjKAy9o';
const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';
// ----------------------------------

// Ждём загрузки всех библиотек
(async function() {
    await new Promise((resolve) => {
        const check = () => {
            if (window.umiBundleDefaults && window.umi && window.umiSignerWalletAdapters && window.mplCandyMachine) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });

    const mintButton = document.getElementById('mintButton');
    const walletStatus = document.getElementById('walletStatus');
    const mintInfo = document.getElementById('mintInfo');

    let umi = null;
    let candyMachine = null;
    let wallet = null;

    const provider = window?.phantom?.solana;

    if (!provider?.isPhantom) {
        walletStatus.innerHTML = '❌ Phantom wallet not found. Please install <a href="https://phantom.app/" target="_blank">Phantom</a>.';
        mintButton.disabled = true;
        mintButton.innerText = 'Phantom required';
    } else {
        // Подключение кошелька
        window.connectWallet = async function() {
            try {
                if (!provider.publicKey) {
                    await provider.connect();
                }
                const walletPublicKey = provider.publicKey.toString();
                wallet = provider.publicKey;

                const umiInstance = umiBundleDefaults.createUmi(RPC_ENDPOINT)
                    .use(mplCandyMachine.mplCandyMachine());
                
                const walletAdapter = {
                    publicKey: provider.publicKey,
                    signMessage: provider.signMessage,
                    signTransaction: provider.signTransaction,
                    signAllTransactions: provider.signAllTransactions,
                };
                umi = umiInstance.use(umiSignerWalletAdapters.walletAdapterIdentity(walletAdapter));

                walletStatus.innerHTML = `✅ Connected: <strong>${walletPublicKey.slice(0,4)}...${walletPublicKey.slice(-4)}</strong>`;
                mintButton.innerText = '🥜 Mint Random Walnut';
                mintButton.disabled = false;

                try {
                    const candyMachinePublicKey = umi.publicKey(CANDY_MACHINE_ID);
                    candyMachine = await mplCandyMachine.fetchCandyMachine(umi, candyMachinePublicKey);
                    const itemsMinted = Number(candyMachine.itemsRedeemed);
                    const itemsAvailable = Number(candyMachine.data.itemsAvailable);
                    mintInfo.innerHTML = `📊 Minted: <strong>${itemsMinted} / ${itemsAvailable}</strong> · Price: 0.1 SOL + fees`;
                } catch (e) {
                    console.warn('Could not fetch candy machine stats', e);
                }
            } catch (err) {
                console.error(err);
                walletStatus.innerHTML = '❌ Connection failed. Please try again.';
            }
        };

        // Минт
        window.mintNft = async function() {
            if (!umi || !wallet) {
                await window.connectWallet();
                if (!umi) return;
            }

            mintButton.disabled = true;
            mintButton.innerText = '⏳ Minting...';
            mintInfo.innerText = 'Processing transaction...';

            try {
                const candyMachinePublicKey = umi.publicKey(CANDY_MACHINE_ID);
                candyMachine = await mplCandyMachine.fetchCandyMachine(umi, candyMachinePublicKey);
                
                if (candyMachine.itemsRedeemed >= candyMachine.data.itemsAvailable) {
                    throw new Error('Collection sold out!');
                }

                const mintBuilder = await mplCandyMachine.mintV2(umi, {
                    candyMachine: candyMachinePublicKey,
                    collectionMint: candyMachine.collectionMint,
                    collectionUpdateAuthority: candyMachine.authority,
                    mintArgs: {
                        solPayment: umi.some({}),
                        mintLimit: umi.some({ id: 1 }),
                        botTax: umi.some({ lamports: 10000000 }), // 0.01 SOL
                    }
                }).buildAndSign(umi);

                const signature = await umi.rpc.sendTransaction(mintBuilder, {
                    commitment: 'confirmed',
                });

                mintInfo.innerHTML = `✅ Mint successful!<br>Signature: <a href="https://solscan.io/tx/${signature}" target="_blank">${signature.slice(0,8)}...${signature.slice(-8)}</a><br>⏳ It may take a moment to appear in your wallet.`;
                
                candyMachine = await mplCandyMachine.fetchCandyMachine(umi, candyMachinePublicKey);
                const itemsMinted = Number(candyMachine.itemsRedeemed);
                const itemsAvailable = Number(candyMachine.data.itemsAvailable);
                mintInfo.innerHTML += `<br>📊 Minted: ${itemsMinted} / ${itemsAvailable}`;

            } catch (err) {
                console.error('Mint error:', err);
                mintInfo.innerHTML = `❌ Error: ${err.message || 'Unknown error'}`;
            } finally {
                mintButton.disabled = false;
                mintButton.innerText = '🥜 Mint Random Walnut';
            }
        };

        // Обработчик клика
        mintButton.addEventListener('click', async () => {
            if (!umi) {
                await window.connectWallet();
            } else {
                await window.mintNft();
            }
        });

        // Изначально кнопка готова к подключению
        mintButton.innerText = '🔌 Connect Wallet';
        mintButton.disabled = false;
    }
})();
