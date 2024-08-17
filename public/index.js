// Add an event listener to the connect button
const connectButton = document.getElementById('connectButton');
connectButton.addEventListener('click', async function() {
    await connectMetaMask();
});

// Add an event listener to the disconnect button
const disconnectButton = document.getElementById('disconnectButton');
disconnectButton.addEventListener('click', disconnectMetaMask);

// Function to connect to MetaMask
async function connectMetaMask() {
    if (typeof window.ethereum !== "undefined") {
        try {
            await ethereum.request({ method: "eth_requestAccounts" })
        } catch (error) {
            console.log(error)
        }
        
        // Request MetaMask to connect and display account selection
        const accounts = await ethereum.request({ method: "eth_accounts" })
        console.log(accounts)
        // Update the connected wallet address in the interface
        document.getElementById('walletAddress').innerText = accounts[0];
        document.getElementById('walletAddressInput').value = accounts[0]; // Update the hidden input field

        // Enable the disconnect button and disable the connect button
        document.getElementById('connectButton').disabled = true;
        document.getElementById('disconnectButton').disabled = false;
        
    } else {
        document.getElementById('walletAddress').innerText = "Please install MetaMask";
        console.error("Please install MetaMask");
    }
}

// Function to disconnect from MetaMask
function disconnectMetaMask() {
    // Clear the connected wallet address from the interface
    document.getElementById('walletAddress').innerText = 'Not connected';
    console.log("Wallet disconnected");

    // Enable the connect button and disable the disconnect button
    document.getElementById('connectButton').disabled = false;
    document.getElementById('disconnectButton').disabled = true;
}