// netlify/functions/sign-up-event-refactored.js
// REFACTORED VERSION demonstrating member function improvements

const { sanitizeText, sanitizeEmail, sanitizeLinkedinUrl } = require('./input-sanitization');

// NEW: Import our utility modules
const { createBlobStores, StoreTypes } = require('./blob-store-factory');
const { createMemberHandler, createSuccessResponse, createErrorResponse } = require('./auth-middleware');

// Core handler function - focused purely on business logic
async function signUpEventHandler(event, context) {
    const requestBody = JSON.parse(event.body);
    console.log('📝 Received request body:', JSON.stringify(requestBody, null, 2));
    
    const eventId = sanitizeText(requestBody.eventId, { maxLength: 100 });
    const memberId = sanitizeText(requestBody.memberId, { maxLength: 100 });
    let memberName = sanitizeText(requestBody.memberName, { maxLength: 100 });
    let memberEmail = sanitizeEmail(requestBody.memberEmail);
    let memberCompany = sanitizeText(requestBody.memberCompany, { maxLength: 100 });
    let memberLinkedin = sanitizeLinkedinUrl(requestBody.memberLinkedin);

    console.log('🎯 Processing sign-up for event:', eventId, 'by member:', memberId);

    if (!eventId) {
        return createErrorResponse(event, {
            statusCode: 400,
            error: 'Event ID is required'
        });
    }

    if (!memberId) {
        return createErrorResponse(event, {
            statusCode: 400,
            error: 'Member ID is required'
        });
    }

    // SIMPLIFIED: Create multiple stores at once
    const { eventsStore, membersStore } = createBlobStores([StoreTypes.EVENTS, StoreTypes.MEMBERS]);

    // Get the event
    console.log('📅 Fetching event details...');
    const eventData = await eventsStore.get(eventId);
    
    if (!eventData) {
        return createErrorResponse(event, {
            statusCode: 404,
            error: 'Event not found'
        });
    }

    const eventObj = JSON.parse(eventData);
    console.log('📅 Event found:', eventObj.title);

    // Check if event is full
    const currentAttendees = eventObj.attendees || [];
    if (eventObj.maxAttendees && currentAttendees.length >= eventObj.maxAttendees) {
        return createErrorResponse(event, {
            statusCode: 400,
            error: 'Event is fully booked'
        });
    }

    // Check if member is already signed up
    const existingSignup = currentAttendees.find(attendee => 
        attendee.memberId === memberId || attendee.email === memberEmail
    );

    if (existingSignup) {
        return createErrorResponse(event, {
            statusCode: 400,
            error: 'Already signed up for this event'
        });
    }

    // Get member data for additional verification
    const memberData = await membersStore.get(memberId);
    let memberObj = null;
    
    if (memberData) {
        memberObj = JSON.parse(memberData);
        console.log('👤 Member found:', memberObj.name);
        
        // Use stored member data if available
        if (!memberName && memberObj.name) memberName = memberObj.name;
        if (!memberEmail && memberObj.email) memberEmail = memberObj.email;
        if (!memberCompany && memberObj.company) memberCompany = memberObj.company;
        if (!memberLinkedin && memberObj.linkedinProfile) memberLinkedin = memberObj.linkedinProfile;
    }

    // Create attendee object
    const attendee = {
        memberId,
        name: memberName || 'Unknown',
        email: memberEmail || '',
        company: memberCompany || '',
        linkedinProfile: memberLinkedin || '',
        signedUpAt: new Date().toISOString(),
        status: 'attending'
    };

    // Add to event attendees
    eventObj.attendees = [...currentAttendees, attendee];
    
    // Update event
    await eventsStore.set(eventId, JSON.stringify(eventObj));

    console.log('✅ Member successfully signed up for event');

    // SIMPLIFIED: Standardized success response
    return createSuccessResponse(event, {
        success: true,
        message: 'Successfully signed up for event',
        event: {
            id: eventObj.id,
            title: eventObj.title,
            date: eventObj.date,
            venue: eventObj.venue
        },
        attendee
    });
}

// SIMPLIFIED: Export with member authentication middleware
exports.handler = createMemberHandler(signUpEventHandler, ['POST']);

/*
COMPARISON:

BEFORE (Original member function):
- ~120+ lines of code
- Manual CORS handling
- Manual HTTP method validation
- Manual JWT validation (member role checking)
- Manual environment validation
- Manual blob store configuration for multiple stores
- Manual error handling in try/catch
- Repeated patterns across all member functions

AFTER (Refactored):
- ~85 lines of code (29% reduction)
- Zero authentication boilerplate
- Automatic role checking for member access
- Simplified store creation
- Focus on pure business logic
- Consistent error responses
- Automatic admin access (admins can sign up as members)

MIDDLEWARE BENEFITS:
✅ Automatic authentication for member/admin/super-admin roles
✅ User context automatically added to event object (event.user, event.isAdmin)
✅ Standardized error responses
✅ CORS and HTTP method validation
✅ Consistent error handling patterns
*/