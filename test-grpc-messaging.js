/**
 * Test script for gRPC messaging service
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Load proto file
const PROTO_PATH = path.join(__dirname, 'backend/services/social-service/proto/messaging.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const messagingProto = grpc.loadPackageDefinition(packageDefinition).messaging;

// Create client (connect to Kubernetes port-forward on 5008, but gRPC is on 50051)
// For testing, we'll need to port-forward the gRPC port as well
const client = new messagingProto.MessagingService(
    'localhost:50051',
    grpc.credentials.createInsecure()
);

async function testGrpcMessaging() {
    console.log('🧪 Testing gRPC Messaging Service\n');

    // Test 1: Get unread count
    console.log('📬 Test 1: Getting unread message count...');
    try {
        const unreadResult = await new Promise((resolve, reject) => {
            client.GetUnreadCount({ user_id: 1 }, (error, response) => {
                if (error) reject(error);
                else resolve(response);
            });
        });
        console.log('✅ Unread count:', unreadResult.unread_count);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    // Test 2: Get conversations
    console.log('\n💬 Test 2: Getting conversations...');
    try {
        const conversations = await new Promise((resolve, reject) => {
            client.GetConversations({ user_id: 1 }, (error, response) => {
                if (error) reject(error);
                else resolve(response);
            });
        });
        console.log('✅ Found', conversations.conversations.length, 'conversations');
        if (conversations.conversations.length > 0) {
            console.log('   First conversation with user:', conversations.conversations[0].other_user_firstname);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    // Test 3: Send a test message
    console.log('\n📤 Test 3: Sending a test message...');
    try {
        const sendResult = await new Promise((resolve, reject) => {
            client.SendMessage({
                sender_id: 1,
                receiver_id: 2,
                content: 'Test message from gRPC client! 🚀'
            }, (error, response) => {
                if (error) reject(error);
                else resolve(response);
            });
        });
        if (sendResult.success) {
            console.log('✅ Message sent successfully!');
            console.log('   Message ID:', sendResult.message.id);
        } else {
            console.log('❌ Failed to send message:', sendResult.error);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    // Test 4: Get messages between two users
    console.log('\n📨 Test 4: Getting messages between users...');
    try {
        const messages = await new Promise((resolve, reject) => {
            client.GetMessages({
                user_id: 1,
                other_user_id: 2,
                limit: 10,
                offset: 0
            }, (error, response) => {
                if (error) reject(error);
                else resolve(response);
            });
        });
        console.log('✅ Found', messages.messages.length, 'messages');
        if (messages.messages.length > 0) {
            const lastMsg = messages.messages[messages.messages.length - 1];
            console.log('   Last message:', lastMsg.content.substring(0, 50) + '...');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    // Test 5: Real-time streaming (will stay connected)
    console.log('\n🔴 Test 5: Testing real-time message streaming...');
    console.log('   Starting stream for user 1...');
    try {
        const stream = client.StreamMessages({ user_id: 1 });
        
        stream.on('data', (response) => {
            console.log('   📩 Stream event received:', response.event_type);
            if (response.message) {
                console.log('      Message:', response.message.content);
            }
        });

        stream.on('error', (error) => {
            console.error('   ❌ Stream error:', error.message);
        });

        stream.on('end', () => {
            console.log('   Stream ended');
        });

        // Keep stream open for 10 seconds
        await new Promise(resolve => setTimeout(resolve, 10000));
        stream.cancel();
        console.log('✅ Stream test completed');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    console.log('\n✨ All tests completed!\n');
}

// Run tests
testGrpcMessaging().catch(console.error);
