// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract BloodTestPurchase is ReentrancyGuard {
    struct Proposal {
        uint256 quantity;
        uint256 pricePerTest;
        string reason;
        bool validity;
        address lab;
        address clinic;
    }

    struct Patient {
        address patientWallet;
        bool acceptedPatient;
    }

    struct PatientApproval {
        address patientWallet;
    }

    mapping(address => Patient) public patients;

    event FundsDeposited(address indexed from, uint256 amount);
    event ProposalSent(address indexed lab, uint256 quantity, uint256 pricePerTest, string reason);
    event ProposalClosed(address indexed lab);
    event PatientAdded(address indexed patientWallet);
    event ProposalAcceptedPatient(address indexed patient);
    event PatientApproved(address indexed patient, string testLink);
    event PaymentMade(address indexed recipient, uint256 amount);
    event TransactionFinalized();

    Proposal public proposal;
    PatientApproval[] public approvals;
    uint256 public totalTests = 0;
    uint256 public totalPaid;

    address public clinic;
    address public lab;
    uint256 public clinicShare = 25;
    uint256 public patientShare = 75;
    string public testLink;
    bool public sentDoc = false;
    bool public paid = false;

    modifier onlyClinic() {
        require(msg.sender == clinic, "Somente a clinica pode chamar essa funcao");
        _;
    }

    modifier onlyLab() {
        require(msg.sender == lab, "Somente o laboratorio pode chamar essa funcao");
        _;
    }

    modifier onlyPatient(address _patientWallet) {
        require(msg.sender == _patientWallet, "Somente o paciente pode chamar essa funcao");
        _;
    }

    constructor(address _clinic, address _lab) {
        clinic = _clinic;
        lab = _lab;
    }

    function depositFunds() public payable onlyLab {
        require(msg.value > 0, "O valor do deposito deve ser maior que zero");
        emit FundsDeposited(msg.sender, msg.value);
    }
    
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function withdrawFunds() public onlyLab {
        uint256 balance = address(this).balance;
        require(balance > 0, "Sem saldo no contrato");
        payable(lab).transfer(balance);
    }

    function sendProposal(uint256 _quantity, uint256 _pricePerTest, string memory _reason) public onlyLab {
        require(!proposal.validity, "Existe uma proposta ativa. Feche-a antes de enviar uma nova.");
        proposal = Proposal({
            quantity: _quantity,
            pricePerTest: _pricePerTest,
            reason: _reason,
            validity: true,
            lab: msg.sender,
            clinic: clinic
        });

        emit ProposalSent(msg.sender, _quantity, _pricePerTest, _reason);
    }

    function closeProposal() public onlyLab {
        require(proposal.validity, "A proposta ja esta fechada");
        proposal.validity = false;
        emit ProposalClosed(msg.sender);
    }

    function addPatient(address _patientWallet) public onlyClinic {
        require(patients[_patientWallet].patientWallet == address(0), "Paciente ja existe");
        patients[_patientWallet] = Patient(_patientWallet, false);
        emit PatientAdded(_patientWallet);
    }


    function acceptProposalPatient(address _patientWallet) public onlyPatient(_patientWallet) {
        require(proposal.validity, "Proposta fechada");
    
        patients[_patientWallet].acceptedPatient = true;
    
        if (patients[_patientWallet].acceptedPatient) {
            approvals.push(PatientApproval({
                patientWallet: _patientWallet
            }));
        }
        totalTests++;
        emit ProposalAcceptedPatient(_patientWallet);
    }

    function sendDoc(string memory _testLink) public onlyClinic{
        require(!proposal.validity || approvals.length == proposal.quantity, "Numero de aprovacoes de pacientes nao corresponde a quantidade de testes");
        testLink = _testLink;
        sentDoc = true;
    }


    function makePayments() public onlyClinic nonReentrant {
        require(!paid, "Pagamento ja realizado");
        require(sentDoc, "Documentos ainda nao foram enviados");
        require(approvals.length == proposal.quantity, "Aprovacoes de pacientes nao correspondem a quantidade da proposta");

        uint256 totalAmount = proposal.quantity * proposal.pricePerTest;
        uint256 clinicAmount = (totalAmount * clinicShare) / 100;
        uint256 patientAmount = (totalAmount * patientShare) / 100;

        require(address(this).balance >= totalAmount, "Saldo insuficiente no contrato");

        payable(clinic).transfer(clinicAmount);
        emit PaymentMade(clinic, clinicAmount);

        uint256 paymentToPatient = patientAmount / approvals.length;
        for (uint256 i = 0; i < approvals.length; i++) {
            payable(approvals[i].patientWallet).transfer(paymentToPatient);
            emit PaymentMade(approvals[i].patientWallet, paymentToPatient);
        }

        totalPaid = totalAmount;
        paid = true;
    }

    function finalizeTransaction() public onlyLab {
        require(!proposal.validity || totalTests == proposal.quantity, "Proposta nao pode ser finalizada ainda");
        require(totalPaid >= (proposal.quantity * proposal.pricePerTest), "Pagamentos nao foram concluidos");

        uint256 balance = address(this).balance;
        if (balance > 0) {
            withdrawFunds();
        }

        delete approvals;

        totalPaid = 0;
        totalTests = 0;
        proposal.validity = false;
        sentDoc = false;
        paid = false;

        emit TransactionFinalized();
    }

    receive() external payable {}
}