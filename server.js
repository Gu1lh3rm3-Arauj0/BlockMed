const { ethers, Wallet } = require('ethers');
const { abi, contractAddress } = require('./public/constants.js'); 

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();  // Carrega as variáveis de ambiente
const nodemailer = require('nodemailer');

const { Web3 } = require('web3');

const web3 = new Web3('https://sepolia.infura.io/v3/6dfb809f2066438f89e674280024049e');

const contract = new web3.eth.Contract(abi, contractAddress);

const labAddress = process.env.LAB_ADDRESS;

const privateKey = process.env.PRIVATE_KEY;

const app = express();
const PORT = 3000;

let proposals = [];  // Armazena todas as propostas enviadas

app.get('/index.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.js'));
});


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
const acceptedPatients = []; // Array para armazenar os pacientes aceitos

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
    res.render('clinicas', { patients, acceptedPatients });
});

app.get('/pacientes', (req, res) => {
    const wallet = req.query.wallet || '';

    // Busca a proposta correspondente à carteira do paciente
    const proposal = proposals.find(p => p.patients.includes(wallet));

    if (proposal) {
        res.render('pacientes', { wallet, proposal });
    } else {
        res.render('pacientes', { wallet, proposal: { labName: 'Nenhuma proposta encontrada', price: 0 } });
    }
});


app.post('/new-patient', (req, res) => {
    const { patientName, patientWalletId, patientEmail } = req.body;
    patients.push({ name: patientName, wallet: patientWalletId, email: patientEmail });
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

app.post('/send-doc', (req, res) => {
    // Lógica para enviar documentos via drive --> temos que achar um jeito de criptografar os arquivos
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

        const tx = contract.methods.sendProposal(quantidade, preco, reason);
        
        const gas = await tx.estimateGas({ from: labAddress });
        const gasPrice = await web3.eth.getGasPrice();
        const data = tx.encodeABI();
        const nonce = await web3.eth.getTransactionCount(labAddress);

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

        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        console.log('Transação bem-sucedida', receipt);
    } catch (error) {
        console.error('Erro ao interagir com o contrato:', error);
    }
});


// encerrar proposta
app.post('/close-proposal', async (req, res) => {
    const { response_proposal } = req.body;
    if (response_proposal == 1) {
        const tx = contract.methods.closeProposal();

        try {
            const gas = await tx.estimateGas({ from: labAddress });
            const gasPrice = await web3.eth.getGasPrice();
            const data = tx.encodeABI();
            const nonce = await web3.eth.getTransactionCount(labAddress);

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

            const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            console.log('Transação bem-sucedida', receipt);
        } catch (error) {
            console.error('Erro ao interagir com o contrato:', error);
        }
    }
    console.log(`Resposta da proposta: ${response_proposal}`);
    
});