const { ethers, Wallet } = require('ethers');
const { abi, contractAddress } = require('./public/constants.js'); 

const Tx = require('ethereumjs-tx').Transaction;

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();  // Carrega as variáveis de ambiente
const nodemailer = require('nodemailer');

const cors = require('cors');

const { Web3 } = require('web3');

const web3 = new Web3('https://sepolia.infura.io/v3/6dfb809f2066438f89e674280024049e');

const contract = new web3.eth.Contract(abi, contractAddress);

const labAddress = process.env.LAB_ADDRESS;

const clinicAddress = process.env.CLINIC_ADDRESS;

const privateKey = process.env.PRIVATE_KEY;

const privateKeyClinic = process.env.PRIVATE_KEY_CLINIC;

const app = express();
const PORT = 3000;

let proposals = [];  // Armazena todas as propostas enviadas
let acceptedPatientsList = []

app.get('/index.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.js'));
});

app.use(cors({
    origin: 'http://localhost:3000', // Adjust as needed
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());

// renderizar servidor 
app.listen(PORT, () => {
    console.log(`Servidor disponível em http://localhost:${PORT}`);
});

// Email credentials
const emailSender = process.env.EMAIL_SENDER;
const emailPassword = process.env.EMAIL_PASSWORD;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

let patients = []; // Array para armazenar todos os pacientes
let acceptedPatients = []; // Array para armazenar os pacientes aceitos

// Email transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465, 
    secure: true,
    auth: {
        user: emailSender,
        pass: emailPassword
    }
});

// Routes

app.get('/', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const userType = req.body.user_type;
    if (userType === 'research_institution') {
        res.redirect('/laboratorios-pesquisa');
    } else if (userType === 'clinic') {
        res.redirect('/clinicas');
    } else if (userType === 'patient') {
        res.redirect('/pacientes');
    } else {
        res.send('Tipo de Usuário Inválido');
    }
});

app.get('/laboratorios-pesquisa', (req, res) => {
    res.render('laboratorios_pesquisa', { acceptedPatients, walletAddress: req.query.wallet || '' });
});

app.get('/clinicas', (req, res) => {
    res.render('clinicas', { patients, acceptedPatients: acceptedPatientsList  });
});

app.get('/pacientes', (req, res) => {
    const wallet = req.query.wallet || '';

    const proposal = proposals.find(p => p.patients.includes(wallet));

    if (proposal) {
        res.render('pacientes', { wallet, proposal });
    } else {
        res.render('pacientes', { wallet, proposal: { labName: proposals[0].labName, price: proposals[0].price, reason: proposals[0].reason } });
    }
});

app.post('/new-patient', async (req, res) => {
    const { patientName, patientWalletId, patientEmail } = req.body;
    patients.push({ name: patientName, wallet: patientWalletId, email: patientEmail });

    try {

        const tx = contract.methods.addPatient(patientWalletId); 
        
        const gas = await tx.estimateGas({ from: clinicAddress });
        const gasPrice = await web3.eth.getGasPrice();
        const data = tx.encodeABI();
        const nonce = await web3.eth.getTransactionCount(clinicAddress);

        const signedTx = await web3.eth.accounts.signTransaction(
            {
                to: contractAddress,
                data,
                gas,
                gasPrice,
                nonce,
                chainId: 11155111 // ID da rede Sepolia
            },
            privateKeyClinic
        );

        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        console.log('Transação bem-sucedida', receipt);
    } catch (error) {
        console.error('Erro ao interagir com o contrato:', error);
    }
    res.redirect('/clinicas');
});

app.post('/send-email', (req, res) => {
    patients.forEach(patient => {
        const mailOptions = {
            from: emailSender,
            to: patient.email,
            subject: "Nova Proposta BlockMed",
            text: `Você recebeu uma nova proposta para seu exame. Por favor acesse: http://localhost:3000/pacientes?wallet=${patient.wallet}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Erro no envio de email:', error);
            } else {
                console.log('Email enviado: ' + info.response);
            }
        });
    });

    res.redirect('/clinicas');
});

// Endpoint para atualizar a lista de aceitos --> conectar com contrato inteligente
app.post('/accept-patient', (req, res) => {
    const { wallet } = req.body;
    const patient = patients.find(p => p.wallet === wallet);
    if (patient) {
        acceptedPatients.push(patient);
        patients = patients.filter(p => p.wallet !== wallet);
    }
    res.redirect('/clinicas');
});

// Lógicas para tornar a página de Usuários com UX Design melhor
app.post('/edit-patient', (req, res) => {
    const { walletId, patientName, patientEmail } = req.body;
    const patient = patients.find(p => p.wallet === walletId);
    if (patient) {
        patient.name = patientName;
        patient.email = patientEmail;
    }
    res.redirect('/clinicas');
});

app.post('/delete-patient', (req, res) => {
    const { wallet } = req.body;
    patients = patients.filter(p => p.wallet !== wallet);
    res.redirect('/clinicas');
});

app.post('/submit-exam', async (req, res) => {
    const { nome_lab, quantidade, preco, reason } = req.body;
    const precoFloat = parseFloat(preco);
    const quantidadeInt = parseInt(quantidade, 10);
    const valueInEther = precoFloat * quantidadeInt;

    // Converter o valor para wei
    const valueInWei = web3.utils.toWei(valueInEther.toString(), 'ether');

    const proposalId = proposals.length + 1;

    proposals.push({
        id: proposalId,
        labName: nome_lab,
        price: preco,
        reason: reason,
        quantity: quantidade,
        patients: []  // Inicialmente, sem pacientes associados
    });

    try {
        // Enviar a transação para depositar fundos
        const depositTx = contract.methods.depositFunds();

        const gasDeposit = await depositTx.estimateGas({ from: labAddress, value: valueInWei });
        const gasPriceDeposit = await web3.eth.getGasPrice();
        const dataDeposit = depositTx.encodeABI();
        const nonceDeposit = await web3.eth.getTransactionCount(labAddress);

        const signedTxDeposit = await web3.eth.accounts.signTransaction(
            {
                to: contractAddress,
                data: dataDeposit,
                gas: gasDeposit,
                gasPrice: gasPriceDeposit,
                nonce: nonceDeposit,
                chainId: 11155111, // ID da rede Sepolia
                value: valueInWei
            },
            privateKey
        );

        const receiptDeposit = await web3.eth.sendSignedTransaction(signedTxDeposit.rawTransaction);
        console.log('Depósito realizado com sucesso', receiptDeposit);

        // Enviar a proposta
        const proposalTx = contract.methods.sendProposal(quantidadeInt, precoFloat, reason);

        const gasProposal = await proposalTx.estimateGas({ from: labAddress });
        const gasPriceProposal = await web3.eth.getGasPrice();
        const dataProposal = proposalTx.encodeABI();
        const nonceProposal = await web3.eth.getTransactionCount(labAddress);

        const signedTxProposal = await web3.eth.accounts.signTransaction(
            {
                to: contractAddress,
                data: dataProposal,
                gas: gasProposal,
                gasPrice: gasPriceProposal,
                nonce: nonceProposal,
                chainId: 11155111 // ID da rede Sepolia
            },
            privateKey
        );

        const receiptProposal = await web3.eth.sendSignedTransaction(signedTxProposal.rawTransaction);
        console.log('Proposta enviada com sucesso', receiptProposal);

        // Enviar email para o laboratório
        const mailOptions = {
            from: emailSender,
            to: 'laboratorioblockchain70@gmail.com',
            subject: `${nome_lab}. Sua proposta foi enviada!`,
            text: `Proposta: ${quantidade} exames de ${reason} por ${preco} wei.`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Erro no envio de email:', error);
                return res.status(500).json({ success: false, message: 'Erro ao enviar email' });
            } else {
                console.log('Email enviado: ' + info.response);
            }
        });

        // res.status(200).json({ success: true, message: 'Proposta enviada com sucesso!' });
    } catch (error) {
        console.error('Erro ao interagir com o contrato:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// encerrar proposta
app.post('/close-proposal', async (req, res) => {
    const { response_proposal } = req.body;

    if (response_proposal == 1) {
        const tx = contract.methods.closeProposal();

        // const tx = contract.methods.finalizeTransaction();

        try {
            // Estimar o gás necessário para a transação
            const gas = await tx.estimateGas({ from: labAddress });
            const gasPrice = await web3.eth.getGasPrice();
            const data = tx.encodeABI();
            const nonce = await web3.eth.getTransactionCount(labAddress);

            // Assinar a transação
            const signedTx = await web3.eth.accounts.signTransaction(
                {
                    to: contractAddress,
                    data,
                    gas,
                    gasPrice,
                    nonce,
                    chainId: 11155111
                },
                privateKey
            );

            // Enviar a transação assinada
            const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            console.log('Transação bem-sucedida', receipt);

            // Convertendo valores BigInt para string, se necessário
            const receiptWithStrings = {
                ...receipt,
                gasUsed: receipt.gasUsed.toString(),
                cumulativeGasUsed: receipt.cumulativeGasUsed.toString(),
                // Adicione outras conversões necessárias aqui
            };

            res.status(200).json({ success: true, receipt: receiptWithStrings });
        } catch (error) {
            console.error('Erro ao interagir com o contrato:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    } else {
        res.status(400).json({ success: false, message: 'Resposta da proposta inválida' });
    }

    console.log(`Resposta da proposta: ${response_proposal}`);
});


app.post('/accept-proposal', async (req, res) => {
    const { walletAddress } = req.body;

    if (!walletAddress) {
        return res.status(400).send('Wallet address is required');
    }

    try {
        const gasEstimate = await contract.methods.acceptProposalPatient(walletAddress).estimateGas({ from: walletAddress });
        const nonce = await web3.eth.getTransactionCount(walletAddress);

        const patient = patients.find(p => p.wallet === walletAddress);

        const rawTx = {
            nonce: web3.utils.toHex(nonce),
            from: walletAddress,
            to: contractAddress,
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            gas: web3.utils.toHex(gasEstimate),
            value: '0x0',
            data: contract.methods.acceptProposalPatient(walletAddress).encodeABI()
        };

        const tx = new Tx(rawTx, { chain: 'ropsten' });
        tx.sign(privateKey);

        const serializedTx = '0x' + tx.serialize().toString('hex');
        const receipt = await web3.eth.sendSignedTransaction(serializedTx);

        console.log('Transaction successful', receipt);
        res.status(200).json({
            message: 'Proposal accepted successfully',
            transactionHash: receipt.transactionHash
        });

        console.log('patient', patient);

        if (patient) {
            acceptedPatientsList.push(patient);
            console.log(acceptedPatientsList);
        } else {
            console.log(`Paciente com Wallet ID ${walletAddress} não encontrado.`);
        }

    } catch (error) {
        console.error('Error preparing or sending transaction:', error);
        res.status(500).send('Error accepting proposal');
    }
});

app.post('/make-payments', async (req, res) => {
    const { docLinkInput } = req.body;

    try {
        // Enviar o link do documento para o contrato
        const txSendDoc = contract.methods.sendDoc(docLinkInput);
        const gasSendDoc = await txSendDoc.estimateGas({ from: clinicAddress });
        const gasPriceSendDoc = await web3.eth.getGasPrice();
        const dataSendDoc = txSendDoc.encodeABI();
        const nonceSendDoc = await web3.eth.getTransactionCount(clinicAddress);

        const signedTxSendDoc = await web3.eth.accounts.signTransaction(
            {
                to: contractAddress,
                data: dataSendDoc,
                gas: gasSendDoc,
                gasPrice: gasPriceSendDoc,
                nonce: nonceSendDoc,
                chainId: 11155111
            },
            privateKeyClinic
        );

        const receiptSendDoc = await web3.eth.sendSignedTransaction(signedTxSendDoc.rawTransaction);
        console.log('Transação de envio de documento bem-sucedida', receiptSendDoc);

        // Agora, chamar makePayments
        const txMakePayments = contract.methods.makePayments();
        const gasMakePayments = await txMakePayments.estimateGas({ from: clinicAddress });
        const gasPriceMakePayments = await web3.eth.getGasPrice();
        const dataMakePayments = txMakePayments.encodeABI();
        const nonceMakePayments = await web3.eth.getTransactionCount(clinicAddress);

        const signedTxMakePayments = await web3.eth.accounts.signTransaction(
            {
                to: contractAddress,
                data: dataMakePayments,
                gas: gasMakePayments,
                gasPrice: gasPriceMakePayments,
                nonce: nonceMakePayments,
                chainId: 11155111
            },
            privateKeyClinic
        );

        const receiptMakePayments = await web3.eth.sendSignedTransaction(signedTxMakePayments.rawTransaction);
        console.log('Transação de pagamento bem-sucedida', receiptMakePayments);

        // Enviar email para o laboratório
        const mailOptions = {
            from: emailSender,
            to: 'laboratorioblockchain70@gmail.com',
            subject: "Link para o drive com os exames dos pacientes",
            text: `Você recebeu o link do drive com os exames dos pacientes que aceitaram a proposta! Agradecemos a confiança! Por favor acesse: ${docLinkInput}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Erro no envio de email:', error);
            } else {
                console.log('Email enviado: ' + info.response);
            }
        });

        res.redirect('/clinicas');

    } catch (error) {
        console.error('Erro ao processar pagamentos:', error);
        res.status(500).send('Erro ao processar pagamentos');
    }
});



app.post('deposit-funds', async (req, res) => {
    const { preco, quantidade } = req.body;

    const precoFloat = parseFloat(preco);
    const quantidadeInt = parseInt(quantidade, 10);

    const valueInEther = precoFloat * quantidadeInt;

    const tx = contract.methods.depositFunds(contractAddress,valueInEther);

        try {
            // Estimar o gás necessário para a transação
            const gas = await tx.estimateGas({ from: labAddress });
            const gasPrice = await web3.eth.getGasPrice();
            const data = tx.encodeABI();
            const nonce = await web3.eth.getTransactionCount(labAddress);

            // Assinar a transação
            const signedTx = await web3.eth.accounts.signTransaction(
                {
                    to: contractAddress,
                    data,
                    gas,
                    gasPrice,
                    nonce,
                    chainId: 11155111 // ID da rede Sepolia
                },
                privateKey
            );

            // Enviar a transação assinada
            const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            console.log('Transação bem-sucedida', receipt);
            res.status(200).json({ success: true, receipt });
        } catch (error) {
            console.error('Erro ao interagir com o contrato:', error);
            res.status(500).json({ success: false, error: error.message });
        }
}) 