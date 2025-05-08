// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../src/session-keys/ShieldedDelegationAccount.sol";
import "../src/utils/TestToken.sol";

contract ShieldedDelegationAccountTest is Test {
    ShieldedDelegationAccount acc;
    TestToken tok;

    // our session‐key's private key for signing
    uint256 SK = 0xBEEF;
    address SKaddr;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    uint256 AES_KEY = 0x2dc875f35f6fa751d30fc934bbf5027760109521adf5f66c9426002180f32bce;
    address relayer = address(0xAA);

    // EIP-712 Constants
    bytes32 constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    bytes32 constant EXECUTE_TYPEHASH = keccak256("Execute(uint256 nonce,bytes cipher)");

    string constant DOMAIN_NAME = "ShieldedDelegationAccount";
    string constant DOMAIN_VERSION = "1";

    function setUp() public {
        // derive the EOA for our test SK
        SKaddr = vm.addr(SK);

        // // Fund the account with ETH for testing
        // vm.deal(address(acc), 100 ether);

        // Fund the relayer with some ETH for gas
        vm.deal(relayer, 1 ether);

        // 1) Deploy the delegation account with masterKey = 1
        // vm.prank(alice);
        acc = new ShieldedDelegationAccount();
        vm.prank(address(acc));
        acc.setAESKey(suint256(AES_KEY));

        // // // 2) Grant a session for SKaddr (no expiry, 1 ETH gas cap)
        // vm.prank(address(acc)); // pretend the contract calls itself
        //     // acc.grantSession(
        //     //     SKaddr,
        //     //     /* expiry  */ 0,
        //     //     /* limitWei*/ 1 ether
        //     // );

        // // // 3) Deploy the shielded token and mint 100 tokens into the account
        tok = new TestToken();
        // vm.prank(alice);
        tok.mint(saddress(address(alice)), suint256(100 * 10 ** 18));
        tok.mint(saddress(address(acc)), suint256(100 * 10 ** 18));
    }

    // Test the grantSession function for a single session key that expires in 24 hours
    function test_grantSession() public {
        vm.prank(address(acc));
        acc.grantSession(
            SKaddr,
            /* expiry  */
            block.timestamp + 24 hours,
            /* limitWei*/
            1 ether
        );

        // Correctly access the tuple values from the sessions array
        (bool authorized, address signer, uint256 expiry, uint256 limitWei, uint256 spentWei, uint256 nonce) =
            acc.sessions(0);

        // Now we can assert individual fields
        assertEq(authorized, true);
        assertEq(signer, SKaddr);
        assertEq(expiry, block.timestamp + 24 hours);
        assertEq(limitWei, 1 ether);
        assertEq(spentWei, 0);
        assertEq(nonce, 0);
    }

    /**
     * @notice Helper function to decrypt using the same master key used to create the account
     * @param nonce       Random nonce that was used during encryption.
     * @param ciphertext  The ciphertext from the encrypt function.
     * @return plaintext  The decrypted result.
     */
    function _decrypt(uint96 nonce, bytes memory ciphertext) internal view returns (bytes memory plaintext) {
        require(ciphertext.length > 0, "Ciphertext cannot be empty");

        address AESDecryptAddr = address(0x67);
        // Pack key, nonce, and ciphertext
        bytes memory input = abi.encodePacked(suint256(AES_KEY), nonce, ciphertext);

        (bool success, bytes memory output) = AESDecryptAddr.staticcall(input);
        require(success, "AES decrypt precompile call failed");

        return output;
    }

    // Test the encrypt view function
    function test_encrypt() public view {
        // Convert string to bytes for the encrypt function
        bytes memory testData = bytes("ABCD");

        (uint96 n, bytes memory c) = acc.encrypt(testData);
        console.logBytes(c);
        console.log("Nonce in test_encrypt: ", n);

        // Decrypt the ciphertext
        bytes memory decrypted = _decrypt(n, c);
        console.logBytes(decrypted);
        assertEq(decrypted, testData);
    }

    // function test_abiEncode() public view {
    //     bytes memory encoded = abi.encodePacked(suint256(AES_KEY));
    //     console.log("encoded");
    //     console.logBytes(encoded);
    //     assertEq(false, true);
    // }

    function test_execute() public {
        vm.prank(address(acc));
        acc.grantSession(
            SKaddr,
            /* expiry  */
            block.timestamp + 24 hours,
            /* limitWei*/
            1 ether
        );

        console.log("src20 transfer selector is");
        bytes memory selectorBytes = abi.encodePacked(SRC20.transfer.selector);
        console.logBytes(selectorBytes);

        // First, create the transfer function call data with proper parameters
        bytes memory transferData = abi.encodeWithSelector(
            SRC20.transfer.selector,
            saddress(address(0xB0B)), // to address (recipient)
            suint256(5 * 10 ** 18) // amount (5 tokens)
        );

        // Then, format it for this specific MultiSend implementation
        bytes memory calls = abi.encodePacked(
            uint8(0), // operation (0 = call)
            address(tok), // to: the token contract address
            uint256(0), // value: 0 ETH (no ETH sent with token transfer)
            uint256(transferData.length), // length of calldata (needs to be uint256 in this implementation)
            transferData // the actual calldata
        );

        console.log("calls is");
        console.logBytes(calls);

        (uint96 encryptedCallsNonce, bytes memory encryptedCalls) = acc.encrypt(calls);
        console.log("encrypted calls is");
        console.logBytes(encryptedCalls);
        console.log("nonce is");
        console.log(encryptedCallsNonce);
        bytes memory decrypted = _decrypt(encryptedCallsNonce, encryptedCalls);
        console.log("decrypted calls is");
        console.logBytes(decrypted);
        assertEq(decrypted, calls);

        uint256 sessionNonce = acc.getSessionNonce(0);

        // 4. Create EIP-712 domain separator (replicating contract's value)
        bytes32 DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes(DOMAIN_VERSION)),
                block.chainid,
                address(acc)
            )
        );
        // 5. Create EIP-712 typed data hash for signing
        bytes32 structHash = keccak256(
            abi.encode(
                EXECUTE_TYPEHASH,
                sessionNonce, // Current session nonce
                keccak256(encryptedCalls)
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        // 6. Sign the digest
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SK, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        console.log("relayer is");
        console.log(relayer);

        console.log("relayer eth balance is");
        console.log(relayer.balance);

        vm.prank(relayer);
        acc.execute(encryptedCallsNonce, encryptedCalls, signature, 0);

        vm.prank(bob);
        uint256 bobBalance = tok.balanceOf();
        console.log("bob balance is");
        console.log(bobBalance);
        assertEq(bobBalance, 5 * 10 ** 18);
    }

    function test_revert_when_session_expired() public {
        vm.prank(address(acc));
        acc.grantSession(
            SKaddr,
            /* expiry  */
            block.timestamp + 24 hours,
            /* limitWei*/
            1 ether
        );

        vm.warp(block.timestamp + 24 hours + 1 hours);

        // First, create the transfer function call data with proper parameters
        bytes memory transferData = abi.encodeWithSelector(
            SRC20.transfer.selector,
            saddress(address(0xB0B)), // to address (recipient)
            suint256(5 * 10 ** 18) // amount (5 tokens)
        );

        // Then, format it for this specific MultiSend implementation
        bytes memory calls = abi.encodePacked(
            uint8(0), // operation (0 = call)
            address(tok), // to: the token contract address
            uint256(0), // value: 0 ETH (no ETH sent with token transfer)
            uint256(transferData.length), // length of calldata (needs to be uint256 in this implementation)
            transferData // the actual calldata
        );

        // 5. Encrypt the transaction
        (uint96 encryptedCallsNonce, bytes memory encryptedCalls) = acc.encrypt(calls);

        // 6. Create and sign the digest
        uint256 sessionNonce = acc.getSessionNonce(0);

        bytes32 DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes(DOMAIN_VERSION)),
                block.chainid,
                address(acc)
            )
        );

        bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, sessionNonce, keccak256(encryptedCalls)));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SK, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // 7. Execute should revert because the session is expired
        vm.prank(relayer);
        vm.expectRevert("expired");
        acc.execute(encryptedCallsNonce, encryptedCalls, signature, 0);

        // 8. Verify bob didn't receive any tokens
        vm.prank(bob);
        uint256 bobBalance = tok.balanceOf();
        assertEq(bobBalance, 0);
    }

    function test_eth_session_limit() public {
        // Fund the account contract with ETH
        vm.deal(address(acc), 100 ether);

        // Grant session with 10 ETH limit
        vm.prank(address(acc));
        acc.grantSession(
            SKaddr,
            /* expiry  */
            block.timestamp + 24 hours,
            /* limitWei*/
            10 ether
        );

        // Record Bob's initial balance
        uint256 initialBalance = address(bob).balance;

        // Create domain separator (used for all signatures)
        bytes32 DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes(DOMAIN_VERSION)),
                block.chainid,
                address(acc)
            )
        );

        // Test 1: First transfer of 6 ETH (should succeed)
        {
            bytes memory calls = abi.encodePacked(
                uint8(0), // operation (0 = call)
                address(bob), // to: bob's address
                uint256(6 ether), // value: 6 ETH
                uint256(0), // data length
                bytes("") // empty data
            );

            (uint96 nonce96, bytes memory cipher) = acc.encrypt(calls);
            uint256 sessionNonce = acc.getSessionNonce(0);

            bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, sessionNonce, keccak256(cipher)));
            bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(SK, digest);
            bytes memory signature = abi.encodePacked(r, s, v);

            vm.prank(relayer);
            acc.execute(nonce96, cipher, signature, 0);

            assertEq(address(bob).balance, initialBalance + 6 ether, "First transfer should succeed");
        }

        // Test 2: Second transfer of 3 ETH (should succeed)
        {
            bytes memory calls = abi.encodePacked(
                uint8(0), // operation (0 = call)
                address(bob), // to: bob's address
                uint256(3 ether), // value: 3 ETH
                uint256(0), // data length
                bytes("") // empty data
            );

            (uint96 nonce96, bytes memory cipher) = acc.encrypt(calls);
            uint256 sessionNonce = acc.getSessionNonce(0);

            bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, sessionNonce, keccak256(cipher)));
            bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(SK, digest);
            bytes memory signature = abi.encodePacked(r, s, v);

            vm.prank(relayer);
            acc.execute(nonce96, cipher, signature, 0);

            assertEq(address(bob).balance, initialBalance + 9 ether, "Second transfer should succeed");
        }

        // Test 3: Third transfer of 2 ETH (should fail - would exceed limit)
        {
            bytes memory calls = abi.encodePacked(
                uint8(0), // operation (0 = call)
                address(bob), // to: bob's address
                uint256(2 ether), // value: 2 ETH
                uint256(0), // data length
                bytes("") // empty data
            );

            (uint96 nonce96, bytes memory cipher) = acc.encrypt(calls);
            uint256 sessionNonce = acc.getSessionNonce(0);

            bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, sessionNonce, keccak256(cipher)));
            bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(SK, digest);
            bytes memory signature = abi.encodePacked(r, s, v);

            vm.prank(relayer);
            vm.expectRevert("spend limit exceeded");
            acc.execute(nonce96, cipher, signature, 0);

            assertEq(address(bob).balance, initialBalance + 9 ether, "Balance should not change after failed transfer");
        }

        // Test 4: Small transfer of 1 ETH (should succeed - exactly reaches limit)
        {
            bytes memory calls = abi.encodePacked(
                uint8(0), // operation (0 = call)
                address(bob), // to: bob's address
                uint256(1 ether), // value: 1 ETH
                uint256(0), // data length
                bytes("") // empty data
            );

            (uint96 nonce96, bytes memory cipher) = acc.encrypt(calls);
            uint256 sessionNonce = acc.getSessionNonce(0);

            bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, sessionNonce, keccak256(cipher)));
            bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(SK, digest);
            bytes memory signature = abi.encodePacked(r, s, v);

            vm.prank(relayer);
            acc.execute(nonce96, cipher, signature, 0);

            assertEq(
                address(bob).balance, initialBalance + 10 ether, "Should allow transfer that exactly reaches limit"
            );
        }

        // Test 5: Final tiny transfer (should fail - exceeds limit)
        {
            bytes memory calls = abi.encodePacked(
                uint8(0), // operation (0 = call)
                address(bob), // to: bob's address
                uint256(0.1 ether), // value: 0.1 ETH
                uint256(0), // data length
                bytes("") // empty data
            );

            (uint96 nonce96, bytes memory cipher) = acc.encrypt(calls);
            uint256 sessionNonce = acc.getSessionNonce(0);

            bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, sessionNonce, keccak256(cipher)));
            bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(SK, digest);
            bytes memory signature = abi.encodePacked(r, s, v);

            vm.prank(relayer);
            vm.expectRevert("spend limit exceeded");
            acc.execute(nonce96, cipher, signature, 0);

            assertEq(address(bob).balance, initialBalance + 10 ether, "No more transfers should be possible");
        }
    }
}
