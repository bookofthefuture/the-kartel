let authToken = localStorage.getItem('kartel_admin_token');
let applications = [], events = [], venues = [], csvData = [];
let currentTab = 'applications', editingVenueId = null;

// LinkedIn URL parsing function
function parseLinkedInProfile(input) {
    if (!input) return '';
    
    // Remove whitespace
    const cleaned = input.trim();
    
    // If empty after trimming, return empty
    if (!cleaned) return '';
    
    // Common LinkedIn URL patterns to match (including uk.linkedin.com)
    const patterns = [
        /^https?:\/\/(www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-]+)\/?.*$/,
        /^https?:\/\/(www\.)?uk\.linkedin\.com\/in\/([a-zA-Z0-9\-]+)\/?.*$/,
        /^https?:\/\/(www\.)?linkedin\.com\/pub\/([a-zA-Z0-9\-]+)\/?.*$/,
        /^https?:\/\/(www\.)?uk\.linkedin\.com\/pub\/([a-zA-Z0-9\-]+)\/?.*$/,
        /^linkedin\.com\/in\/([a-zA-Z0-9\-]+)\/?.*$/,
        /^uk\.linkedin\.com\/in\/([a-zA-Z0-9\-]+)\/?.*$/,
        /^www\.linkedin\.com\/in\/([a-zA-Z0-9\-]+)\/?.*$/,
        /^www\.uk\.linkedin\.com\/in\/([a-zA-Z0-9\-]+)\/?.*$/,
        /^([a-zA-Z0-9\-]+)$/  // Just the username
    ];
    
    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match) {
            // For full URLs, extract the username from group 2
            // For just username, it's in group 1
            return match[2] || match[1];
        }
    }
    
    // If no pattern matches, try to extract from any LinkedIn URL
    const fallbackMatch = cleaned.match(/(uk\.)?linkedin\.com\/in\/([a-zA-Z0-9\-]+)/);
    if (fallbackMatch) {
        return fallbackMatch[2];
    }
    
    // If it looks like a username (no spaces, no special chars except hyphens)
    if (/^[a-zA-Z0-9\-]+$/.test(cleaned)) {
        return cleaned;
    }
    
    // Return as-is if we can't parse it
    return cleaned;
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
    event.target.classList.add('active');
    currentTab = tabName;
    if (tabName === 'applications') loadApplications();
    else if (tabName === 'events') { loadEvents(); loadVenuesForDropdown(); }
    else if (tabName === 'venues') loadVenues();
    else if (tabName === 'content') { loadGalleryManagement(); loadFaqs(); loadExperienceVideo(); }
}

function showMessage(message, type = 'success', container = 'messageContainer') {
    const messageContainer = document.getElementById(container);
    messageContainer.innerHTML = `<div class="${type}">${message}</div>`;
    setTimeout(() => messageContainer.innerHTML = '', 5000);
}

function showError(message, container = 'messageContainer') { showMessage(message, 'error', container); }

async function loadVenues() {
    try {
        const response = await fetch('/.netlify/functions/get-venues', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.status === 401) { authToken = null; localStorage.removeItem('kartel_admin_token'); showLogin(); return; }
        if (!response.ok) throw new Error('Failed to load venues');
        const data = await response.json();
        venues = data.venues || [];
        updateVenueStats();
        renderVenues();
    } catch (error) {
        console.error('Error loading venues:', error);
        showError('Failed to load venues. Please try again.', 'venuesMessageContainer');
    }
}

async function loadVenuesForDropdown() {
    try {
        console.log('🏢 loadVenuesForDropdown() called, authToken:', authToken ? 'present' : 'missing');
        const response = await fetch('/.netlify/functions/get-venues', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        console.log('🏢 Venues API response status:', response.status);
        if (response.ok) {
            const data = await response.json();
            venues = data.venues || [];
            console.log('🏢 Venues loaded:', venues.length, 'venues');
            populateVenueDropdown();
        }
    } catch (error) { 
        console.error('🏢 Error loading venues for dropdown:', error); 
    }
}

function populateVenueDropdown() {
    const select = document.getElementById('eventVenue');
    while (select.children.length > 2) select.removeChild(select.lastChild);
    venues.forEach(venue => {
        const option = document.createElement('option');
        option.value = venue.id;
        option.textContent = venue.name;
        select.appendChild(option);
    });
}

function updateVenueStats() {
    const total = venues.length;
    const thisMonth = venues.filter(venue => {
        const venueDate = new Date(venue.createdAt);
        const now = new Date();
        return venueDate.getMonth() === now.getMonth() && venueDate.getFullYear() === now.getFullYear();
    }).length;
    document.getElementById('totalVenues').textContent = total;
    document.getElementById('activeVenues').textContent = total;
    document.getElementById('venuesWithEvents').textContent = 0;
    document.getElementById('recentVenues').textContent = thisMonth;
}

function renderVenues(filteredVenues = null) {
    const container = document.getElementById('venuesContainer');
    const venuesToRender = filteredVenues || venues;
    if (venuesToRender.length === 0) {
        container.innerHTML = `
            <div class="search-container">
                <input type="text" class="search-input" id="venueSearch" placeholder="Search venues..." onkeyup="filterVenues()">
            </div>
            <div class="empty-state">
                <h3>No venues found</h3>
                <p>Start by adding your first karting venue to manage events effectively.</p>
                <button class="btn btn-success" onclick="openAddVenueModal()">Add Your First Venue</button>
            </div>
        `;
        return;
    }
    const venuesHTML = venuesToRender.map(venue => `
        <div class="venue-card">
            <div class="venue-name">${venue.name}</div>
            <div class="venue-details">
                <div class="venue-detail"><strong>Address:</strong> ${venue.address}</div>
                ${venue.phone ? `<div class="venue-detail"><strong>Phone:</strong> ${venue.phone}</div>` : ''}
                ${venue.website ? `<div class="venue-detail"><strong>Website:</strong> <a href="${venue.website}" target="_blank" style="color: #e74c3c;">Visit Site</a></div>` : ''}
                ${venue.notes ? `<div class="venue-detail"><strong>Notes:</strong> ${venue.notes}</div>` : ''}
                ${venue.drivingTips ? `<div class="venue-detail"><strong>Driving Tips:</strong> ${venue.drivingTips.substring(0, 100)}${venue.drivingTips.length > 100 ? '...' : ''}</div>` : ''}
                ${venue.vimeoId ? `<div class="venue-detail"><strong>Video:</strong> <a href="https://vimeo.com/${venue.vimeoId}" target="_blank" style="color: #e74c3c;">Watch on Vimeo</a></div>` : ''}
                ${venue.trackMapPath ? `<div class="venue-detail"><strong>Track Map:</strong> <span style="color: #27ae60;">✓ Available</span></div>` : ''}
                <div class="venue-detail"><strong>Added:</strong> ${new Date(venue.createdAt).toLocaleDateString()}</div>
            </div>
            <div class="venue-actions">
                <button class="action-btn edit-btn btn-small" onclick="editVenue('${venue.id}')">Edit</button>
                <button class="action-btn delete-btn btn-small" onclick="deleteVenue('${venue.id}')">Delete</button>
            </div>
        </div>
    `).join('');
    container.innerHTML = `
        <div class="search-container">
            <input type="text" class="search-input" id="venueSearch" placeholder="Search venues..." onkeyup="filterVenues()" value="${document.getElementById('venueSearch')?.value || ''}">
        </div>
        <div class="venues-grid">${venuesHTML}</div>
    `;
}

function filterVenues() {
    const searchTerm = document.getElementById('venueSearch').value.toLowerCase();
    if (!searchTerm.trim()) { renderVenues(); return; }
    const filteredVenues = venues.filter(venue => 
        venue.name.toLowerCase().includes(searchTerm) ||
        venue.address.toLowerCase().includes(searchTerm) ||
        (venue.notes && venue.notes.toLowerCase().includes(searchTerm)) ||
        (venue.drivingTips && venue.drivingTips.toLowerCase().includes(searchTerm))
    );
    renderVenues(filteredVenues);
}

function openAddVenueModal() {
    editingVenueId = null;
    document.getElementById('modalTitle').textContent = 'Add New Venue';
    document.getElementById('venueForm').reset();
    
    // Clear preview elements
    document.getElementById('trackMapPreview').style.display = 'none';
    document.getElementById('vimeoPreview').style.display = 'none';
    document.getElementById('vimeoPreview').querySelector('iframe').src = '';
    
    document.getElementById('venueModal').style.display = 'block';
}

function editVenue(venueId) {
    const venue = venues.find(v => v.id === venueId);
    if (!venue) return;
    editingVenueId = venueId;
    document.getElementById('modalTitle').textContent = 'Edit Venue';
    document.getElementById('venueId').value = venue.id;
    document.getElementById('venueName').value = venue.name;
    document.getElementById('venueAddress').value = venue.address;
    document.getElementById('venuePhone').value = venue.phone || '';
    document.getElementById('venueWebsite').value = venue.website || '';
    document.getElementById('venueNotes').value = venue.notes || '';
    
    // New fields for track information
    document.getElementById('venueDrivingTips').value = venue.drivingTips || '';
    document.getElementById('venueVimeoId').value = venue.vimeoId || '';
    
    // Handle track map display if it exists
    const trackMapPreview = document.getElementById('trackMapPreview');
    const trackMapImage = document.getElementById('trackMapImage');
    if (venue.trackMapPath) {
        trackMapImage.src = `/.netlify/functions/get-photo?path=${encodeURIComponent(venue.trackMapPath)}`;
        trackMapPreview.style.display = 'block';
    } else {
        trackMapPreview.style.display = 'none';
    }
    
    // Handle Vimeo preview if ID exists
    const vimeoPreview = document.getElementById('vimeoPreview');
    const iframe = vimeoPreview.querySelector('iframe');
    if (venue.vimeoId && /^\d+$/.test(venue.vimeoId)) {
        iframe.src = `https://player.vimeo.com/video/${venue.vimeoId}`;
        vimeoPreview.style.display = 'block';
    } else {
        vimeoPreview.style.display = 'none';
        iframe.src = '';
    }
    
    document.getElementById('venueModal').style.display = 'block';
}

function closeVenueModal() {
    document.getElementById('venueModal').style.display = 'none';
    editingVenueId = null;
}

async function deleteVenue(venueId) {
    const venue = venues.find(v => v.id === venueId);
    if (!venue || !confirm(`Are you sure you want to delete "${venue.name}"?`)) return;
    try {
        const response = await fetch('/.netlify/functions/delete-venue', {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ venueId })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showMessage(result.message, 'success', 'venuesMessageContainer');
            loadVenues();
            loadVenuesForDropdown();
        } else {
            showError(result.error || 'Failed to delete venue', 'venuesMessageContainer');
        }
    } catch (error) {
        console.error('Error deleting venue:', error);
        showError('Failed to delete venue. Please try again.', 'venuesMessageContainer');
    }
}

async function loadApplications() {
    try {
        console.log('📋 loadApplications() called, authToken:', authToken ? 'present' : 'missing');
        console.log('📋 Making API call to get-applications...');
        
        const response = await fetch('/.netlify/functions/get-applications', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        console.log('📋 API response status:', response.status);
        
        if (response.status === 401) { 
            console.log('📋 401 Unauthorized - clearing token');
            authToken = null; 
            localStorage.removeItem('kartel_admin_token'); 
            showLogin(); 
            return; 
        }
        if (!response.ok) throw new Error('Failed to load applications');
        
        const data = await response.json();
        console.log('📋 Applications data received:', data.applications ? data.applications.length : 0, 'applications');
        
        applications = data.applications || [];
        updateStats();
        renderApplicationsTable();
        
        console.log('📋 loadApplications() completed successfully');
    } catch (error) {
        console.error('📋 Error loading applications:', error);
        showError('Failed to load applications. Please try again.');
    }
}

async function loadEvents() {
    try {
        const response = await fetch('/.netlify/functions/get-events', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.status === 401) { authToken = null; localStorage.removeItem('kartel_admin_token'); showLogin(); return; }
        if (!response.ok) throw new Error('Failed to load events');
        const data = await response.json();
        events = data.events || [];
        updateEventStats();
        renderEventsTable();
    } catch (error) {
        console.error('Error loading events:', error);
        showError('Failed to load events. Please try again.', 'eventsMessageContainer');
    }
}

function updateStats() {
    const total = applications.length;
    const pending = applications.filter(app => app.status === 'pending').length;
    const approved = applications.filter(app => app.status === 'approved').length;
    const rejected = applications.filter(app => app.status === 'rejected').length;
    document.getElementById('totalApplications').textContent = total;
    document.getElementById('pendingApplications').textContent = pending;
    document.getElementById('approvedApplications').textContent = approved;
    document.getElementById('rejectedApplications').textContent = rejected;
}

function updateEventStats() {
    const total = events.length;
    const upcoming = events.filter(evt => evt.status === 'upcoming').length;
    const completed = events.filter(evt => evt.status === 'completed').length;
    const totalPhotos = events.reduce((sum, evt) => sum + (evt.photos ? evt.photos.length : 0), 0);
    document.getElementById('totalEvents').textContent = total;
    document.getElementById('upcomingEvents').textContent = upcoming;
    document.getElementById('completedEvents').textContent = completed;
    document.getElementById('totalPhotos').textContent = totalPhotos;
}

function renderApplicationsTable() {
    const tbody = document.getElementById('applicationsTableBody');
    if (applications.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No applications found</td></tr>';
        return;
    }
    tbody.innerHTML = applications.map(app => `
        <tr>
            <td>
                <strong>${app.fullName || `${app.firstName || ''} ${app.lastName || ''}`.trim() || app.name || 'N/A'}</strong>
                ${app.isAdmin ? '<br><span style="color: #e74c3c; font-weight: bold; font-size: 12px;">👑 Administrator</span>' : ''}
                ${app.importedAt ? '<br><small style="color: #6c757d;">📥 Imported</small>' : ''}
            </td>
            <td>${app.email}</td>
            <td>
                <strong>${app.company || 'N/A'}</strong>
                ${app.position ? `<br><small>${app.position}</small>` : ''}
            </td>
            <td>${app.phone}</td>
            <td>
                ${app.linkedin ? `<a href="https://linkedin.com/in/${app.linkedin}" target="_blank" style="color: #0077b5; text-decoration: none;">🔗 ${app.linkedin}</a>` : 'N/A'}
            </td>
            <td><span class="status-badge status-${app.status}">${app.status}</span></td>
            <td>${new Date(app.submittedAt).toLocaleDateString()}</td>
            <td>
                ${app.status === 'pending' ? `
                    <button class="action-btn approve-btn" onclick="updateApplication('${app.id}', 'approved')">Approve</button>
                    <button class="action-btn reject-btn" onclick="updateApplication('${app.id}', 'rejected')">Reject</button>
                ` : ''}
                <button class="action-btn details-btn" onclick="showDetails('${app.id}')">Details</button>
                <button class="action-btn delete-btn" onclick="deleteApplication('${app.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function renderEventsTable() {
    const tbody = document.getElementById('eventsTableBody');
    if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No events found</td></tr>';
        return;
    }
    tbody.innerHTML = events.map(evt => `
        <tr>
            <td><strong>${evt.name}</strong></td>
            <td>${new Date(evt.date).toLocaleDateString()}${evt.time ? `<br><small>${evt.time}</small>` : ''}</td>
            <td><strong>${evt.venue}</strong></td>
            <td>
                <span class="status-badge status-approved">${evt.attendees ? evt.attendees.length : 0}</span>
                ${evt.attendees && evt.attendees.length > 0 ? 
                    `<br><small>${evt.attendees.filter(a => a.attended).length} attended</small>` : 
                    ''
                }
            </td>
            <td><span class="status-badge status-approved">${evt.photos ? evt.photos.length : 0}</span></td>
            <td><span class="status-badge status-pending">${evt.videos ? evt.videos.length : 0}</span></td>
            <td><span class="status-badge status-${evt.status}">${evt.status}</span></td>
            <td>
                <button class="action-btn edit-btn" onclick="editEvent('${evt.id}')">Edit</button>
                <button class="action-btn delete-btn" onclick="deleteEvent('${evt.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function editEvent(eventId) {
    const event = events.find(e => e.id === eventId);
    if (!event) {
        showError('Event not found', 'eventsMessageContainer');
        return;
    }
    
    // Populate the edit form (existing code)
    document.getElementById('editEventId').value = event.id;
    document.getElementById('editEventName').value = event.name;
    document.getElementById('editEventDate').value = event.date;
    document.getElementById('editEventTime').value = event.time || '';
    document.getElementById('editEventMaxAttendees').value = event.maxAttendees || '';
    document.getElementById('editEventStatus').value = event.status || 'upcoming';
    document.getElementById('editEventDescription').value = event.description || '';
    
    // Populate venue dropdown if venues are loaded
    populateEditEventVenueDropdown();
    
    // Set the venue if it exists
    if (event.venueId) {
        document.getElementById('editEventVenue').value = event.venueId;
    } else {
        // If no venueId, try to match by venue name
        const venueOption = Array.from(document.getElementById('editEventVenue').options)
            .find(option => option.textContent === event.venue);
        if (venueOption) {
            document.getElementById('editEventVenue').value = venueOption.value;
        }
    }
    
    // Load event photos and videos
    loadEventPhotos(event.id);
    loadEventVideos(event.id);
    
    // Load attendees and approved members
    loadEventAttendees(event.id);
    loadApprovedMembers();
    
    // Load member count for email section
    loadModalMemberCount();
    
    // Set up email button event listeners for this event
    setupEmailButtons(event.id);
    
    // Show email section for existing events
    const emailSection = document.querySelector('.email-section');
    if (emailSection) {
        emailSection.style.display = 'block';
    }
    
    // Show the modal
    document.getElementById('eventModal').style.display = 'block';
}

// Photo upload functionality
document.getElementById('photoUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('photoPreview');
    const uploadBtn = document.getElementById('uploadPhotoBtn');
    
    if (file) {
        // Show preview
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            uploadBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    } else {
        preview.style.display = 'none';
        uploadBtn.disabled = true;
    }
});

document.getElementById('uploadPhotoBtn').addEventListener('click', async function() {
    const fileInput = document.getElementById('photoUpload');
    const captionInput = document.getElementById('photoCaption');
    const eventId = document.getElementById('editEventId').value;
    
    if (!fileInput.files[0] || !eventId) {
        showError('Please select a photo and ensure an event is selected', 'eventsMessageContainer');
        return;
    }
    
    const file = fileInput.files[0];
    const caption = captionInput.value.trim();
    
    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async function(e) {
        const photoData = e.target.result;
        
        const uploadBtn = document.getElementById('uploadPhotoBtn');
        const originalText = uploadBtn.textContent;
        uploadBtn.textContent = 'Uploading...';
        uploadBtn.disabled = true;
        
        try {
            const response = await fetch('/.netlify/functions/upload-photo', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    eventId: eventId,
                    photoData: photoData,
                    fileName: file.name,
                    caption: caption
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                showMessage('Photo uploaded successfully!', 'success', 'eventsMessageContainer');
                
                // Clear the form
                fileInput.value = '';
                captionInput.value = '';
                document.getElementById('photoPreview').style.display = 'none';
                
                // Refresh the photos display
                await loadEventPhotos(eventId);
                
                // Refresh events list to show updated photo count
                loadEvents();
                
            } else {
                showError(result.error || 'Failed to upload photo', 'eventsMessageContainer');
            }
            
        } catch (error) {
            console.error('Photo upload error:', error);
            showError('Failed to upload photo. Please try again.', 'eventsMessageContainer');
        } finally {
            uploadBtn.textContent = originalText;
            uploadBtn.disabled = false;
        }
    };
    
    reader.readAsDataURL(file);
});

// Load and display event photos
async function loadEventPhotos(eventId) {
    try {
        const response = await fetch('/.netlify/functions/get-events', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const event = data.events.find(e => e.id === eventId);
            
            if (event && event.photos) {
                displayEventPhotos(event.photos);
            } else {
                displayEventPhotos([]);
            }
        }
    } catch (error) {
        console.error('Error loading event photos:', error);
    }
}

function displayEventPhotos(photos) {
    const photosGrid = document.getElementById('eventPhotosGrid');
    
    if (!photos || photos.length === 0) {
        photosGrid.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No photos uploaded yet</p>';
        return;
    }
    
    const photosHTML = photos.map(photo => `
        <div class="photo-item">
            <img src="/.netlify/functions/get-photo?path=${encodeURIComponent(photo.path)}" 
                alt="${photo.caption || 'Event photo'}"
                onerror="this.style.display='none'">
            ${photo.caption ? `<div class="photo-caption">${photo.caption}</div>` : ''}
        </div>
    `).join('');
    
    photosGrid.innerHTML = photosHTML;
}

// Video upload functionality
document.getElementById('videoUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('videoPreview');
    const uploadBtn = document.getElementById('uploadVideoBtn');
    
    if (file) {
        // Check file size (500MB limit)
        const maxSize = 500 * 1024 * 1024; // 500MB
        if (file.size > maxSize) {
            showError('Video file size must be less than 500MB', 'eventsMessageContainer');
            e.target.value = '';
            return;
        }
        
        // Show preview
        const videoURL = URL.createObjectURL(file);
        preview.src = videoURL;
        preview.style.display = 'block';
        uploadBtn.disabled = false;
        
        // Auto-populate title if empty
        const titleInput = document.getElementById('videoTitle');
        if (!titleInput.value) {
            titleInput.value = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        }
    } else {
        preview.style.display = 'none';
        uploadBtn.disabled = true;
    }
});

document.getElementById('uploadVideoBtn').addEventListener('click', async function() {
    const fileInput = document.getElementById('videoUpload');
    const titleInput = document.getElementById('videoTitle');
    const descriptionInput = document.getElementById('videoDescription');
    const eventId = document.getElementById('editEventId').value;
    
    if (!fileInput.files[0] || !eventId) {
        showError('Please select a video and ensure an event is selected', 'eventsMessageContainer');
        return;
    }
    
    const file = fileInput.files[0];
    const title = titleInput.value.trim() || file.name;
    const description = descriptionInput.value.trim();
    
    // Show progress
    const uploadBtn = this;
    const originalText = uploadBtn.textContent;
    const progressDiv = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');
    
    uploadBtn.textContent = 'Preparing Upload...';
    uploadBtn.disabled = true;
    progressDiv.style.display = 'block';
    progressBar.style.width = '10%';
    
    try {
        // Convert file to base64
        const reader = new FileReader();
        reader.onload = async function(e) {
            const videoData = e.target.result;
            
            progressBar.style.width = '30%';
            uploadBtn.textContent = 'Uploading to Vimeo...';
            
            try {
                const response = await fetch('/.netlify/functions/upload-video-vimeo', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        eventId: eventId,
                        videoData: videoData,
                        fileName: file.name,
                        title: title,
                        description: description
                    })
                });
                
                progressBar.style.width = '90%';
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    progressBar.style.width = '100%';
                    showMessage(`Video uploaded successfully to Vimeo! <a href="${result.vimeoUrl}" target="_blank">View Video</a>`, 'success', 'eventsMessageContainer');
                    
                    // Clear the form
                    fileInput.value = '';
                    titleInput.value = '';
                    descriptionInput.value = '';
                    document.getElementById('videoPreview').style.display = 'none';
                    
                    // Refresh the videos display
                    await loadEventVideos(eventId);
                    
                    // Refresh events list
                    loadEvents();
                    
                } else {
                    showError(result.error || 'Failed to upload video to Vimeo', 'eventsMessageContainer');
                }
                
            } catch (uploadError) {
                console.error('Video upload error:', uploadError);
                showError('Failed to upload video. Please try again.', 'eventsMessageContainer');
            } finally {
                uploadBtn.textContent = originalText;
                uploadBtn.disabled = false;
                progressDiv.style.display = 'none';
                progressBar.style.width = '0%';
            }
        };
        
        reader.readAsDataURL(file);
        
    } catch (error) {
        console.error('Video processing error:', error);
        showError('Failed to process video file. Please try again.', 'eventsMessageContainer');
        uploadBtn.textContent = originalText;
        uploadBtn.disabled = false;
        progressDiv.style.display = 'none';
    }
});

// Load and display event videos
async function loadEventVideos(eventId) {
    try {
        const response = await fetch('/.netlify/functions/get-events', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const event = data.events.find(e => e.id === eventId);
            
            if (event && event.videos) {
                displayEventVideos(event.videos);
            } else {
                displayEventVideos([]);
            }
        }
    } catch (error) {
        console.error('Error loading event videos:', error);
    }
}

function displayEventVideos(videos) {
    const videosGrid = document.getElementById('eventVideosGrid');
    
    if (!videos || videos.length === 0) {
        videosGrid.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No videos uploaded yet</p>';
        return;
    }
    
    const videosHTML = videos.map(video => `
        <div style="border: 1px solid #ecf0f1; border-radius: 8px; padding: 15px; background: white;">
            <div style="aspect-ratio: 16/9; margin-bottom: 10px;">
                <iframe src="https://player.vimeo.com/video/${video.vimeoId}" 
                        width="100%" height="100%" frameborder="0" 
                        allow="autoplay; fullscreen; picture-in-picture" allowfullscreen
                        style="border-radius: 4px;">
                </iframe>
            </div>
            <h5 style="color: #2c3e50; margin-bottom: 5px; font-size: 1rem;">${video.title || 'Untitled Video'}</h5>
            ${video.description ? `<p style="color: #7f8c8d; font-size: 0.9rem; margin-bottom: 8px;">${video.description}</p>` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #999;">
                <span>Uploaded: ${new Date(video.uploadedAt).toLocaleDateString()}</span>
                <a href="https://vimeo.com/${video.vimeoId}" target="_blank" style="color: #3498db;">View on Vimeo</a>
            </div>
        </div>
    `).join('');
    
    videosGrid.innerHTML = videosHTML;
}

function closeEventModal() {
    document.getElementById('eventModal').style.display = 'none';
    // Reset email section visibility
    const emailSection = document.querySelector('.email-section');
    if (emailSection) {
        emailSection.style.display = 'none';
    }
}

function populateEditEventVenueDropdown() {
    const select = document.getElementById('editEventVenue');
    // Clear existing options except the first one
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }
    
    // Add venue options
    venues.forEach(venue => {
        const option = document.createElement('option');
        option.value = venue.id;
        option.textContent = venue.name;
        select.appendChild(option);
    });
}

async function updateApplication(applicationId, status) {
    try {
        const response = await fetch('/.netlify/functions/update-application', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId, status, sendEmail: true })
        });
        if (!response.ok) throw new Error('Failed to update application');
        showMessage(`Application ${status} successfully! Email sent to applicant.`);
        loadApplications();
    } catch (error) {
        console.error('Error updating application:', error);
        showError('Failed to update application. Please try again.');
    }
}

async function deleteApplication(applicationId) {
    const app = applications.find(a => a.id === applicationId);
    if (!app) return;
    const fullName = app.fullName || `${app.firstName || ''} ${app.lastName || ''}`.trim() || 'Unknown';
    if (!confirm(`Are you sure you want to permanently delete the application for ${fullName}?`)) return;
    try {
        const response = await fetch('/.netlify/functions/delete-application', {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId })
        });
        if (!response.ok) throw new Error('Failed to delete application');
        showMessage(`Application for ${fullName} deleted successfully.`);
        loadApplications();
    } catch (error) {
        console.error('Error deleting application:', error);
        showError('Failed to delete application. Please try again.');
    }
}

function showDetails(applicationId) {
    const app = applications.find(a => a.id === applicationId);
    if (!app) return;
    
    // Populate the form with current application data
    document.getElementById('applicantId').value = app.id;
    document.getElementById('applicantFirstName').value = app.firstName || '';
    document.getElementById('applicantLastName').value = app.lastName || '';
    document.getElementById('applicantEmail').value = app.email || '';
    document.getElementById('applicantCompany').value = app.company || '';
    document.getElementById('applicantPosition').value = app.position || '';
    document.getElementById('applicantPhone').value = app.phone || '';
    document.getElementById('applicantLinkedin').value = app.linkedin || '';
    document.getElementById('applicantOriginalMessage').value = app.message || '';
    document.getElementById('applicantStatus').value = app.status || 'pending';
    document.getElementById('applicantSubmitted').value = new Date(app.submittedAt).toLocaleString();
    document.getElementById('applicantIsAdmin').checked = app.isAdmin || false;
    
    // Clear any previous messages
    const messageContainer = document.getElementById('applicantMessage');
    if (messageContainer) {
        messageContainer.classList.add('hidden');
        messageContainer.textContent = '';
    }
    
    // Show the modal
    document.getElementById('applicantModal').style.display = 'block';
}

function closeApplicantModal() {
    document.getElementById('applicantModal').style.display = 'none';
}

async function updateApplicantDetails(applicantData) {
    try {
        const response = await fetch('/.netlify/functions/update-applicant-details', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(applicantData)
        });

        if (response.status === 401) {
            authToken = null;
            localStorage.removeItem('kartel_admin_token');
            showLogin();
            return false;
        }

        const result = await response.json();

        if (response.ok && result.success) {
            showMessage('Applicant details updated successfully!', 'success', 'messageContainer');
            loadApplications(); // Refresh the applications list
            return true;
        } else {
            showMessage(result.error || 'Failed to update applicant details.', 'error', 'applicantMessage');
            return false;
        }
    } catch (error) {
        console.error('Error updating applicant details:', error);
        showMessage('Failed to update applicant details due to network error. Please try again.', 'error', 'applicantMessage');
        return false;
    }
}

function deleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event?')) return;
    alert('Event deletion feature coming soon!');
}


function showLogin() {
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
}

function showDashboard() {
    console.log('🏠 showDashboard() called');
    console.log('🏠 Hiding login section, showing dashboard section');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    console.log('🏠 Calling loadApplications() from showDashboard()');
    loadApplications();
}

function updateUserDisplay(user) {
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement && user) {
        // Show just the first name like the member area
        const firstName = user.firstName || user.name?.split(' ')[0] || user.email || 'Admin';
        userEmailElement.textContent = firstName;
    }
}

function openAdminProfile() {
    // For now, just show an alert - could be enhanced with a proper modal later
    const storedUser = localStorage.getItem('kartel_admin_user');
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            alert(`Admin Profile\n\nName: ${user.name || 'Not set'}\nEmail: ${user.email || 'Not set'}\n\nAdmin profile management coming soon!`);
        } catch (error) {
            alert('Admin profile information is not available.');
        }
    } else {
        alert('Admin profile information is not available.');
    }
}

function checkAuth() {
    // Check if user switched from member view
    const switchedFromMember = sessionStorage.getItem('switched_from_member');
    if (switchedFromMember) {
        console.log('👤 User switched from member view, ensuring admin context...');
        sessionStorage.removeItem('switched_from_member');
    }
    
    if (authToken) {
        // Restore user information from localStorage
        const storedUser = localStorage.getItem('kartel_admin_user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                console.log('🔍 Restoring admin user display:', user);
                updateUserDisplay(user);
            } catch (error) {
                console.error('Error parsing stored user data:', error);
            }
        } else {
            console.log('⚠️ No admin user data found, display may show default');
        }
        showDashboard();
    } else {
        showLogin();
    }
}

async function checkQuickActionParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const applicationId = urlParams.get('id');
    const actionToken = urlParams.get('token');
    
    if (action && applicationId && actionToken) {
        console.log(`🚀 Processing quick action from URL: ${action} for ${applicationId}`);
        
        // Clear URL parameters to prevent re-processing
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Process the quick action
        await processQuickAction(action, applicationId, actionToken);
    }
}

async function processQuickAction(action, applicationId, actionToken) {
    try {
        // Show loading message
        showMessage('Processing quick action...', 'info', 'messageContainer');
        
        const response = await fetch('/.netlify/functions/quick-action', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: action,
                applicationId: applicationId,
                actionToken: actionToken
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            const actionText = action === 'approve' ? 'approved' : 'rejected';
            showMessage(
                `✅ Application from ${result.application?.name || 'applicant'} has been ${actionText} successfully!`, 
                'success', 
                'messageContainer'
            );
            
            // Refresh applications list if user is logged in
            if (authToken) {
                loadApplications();
            }
        } else {
            showMessage(
                `❌ Quick action failed: ${result.error || 'Unknown error'}`, 
                'error', 
                'messageContainer'
            );
        }
    } catch (error) {
        console.error('Quick action error:', error);
        showMessage('❌ Quick action failed due to network error', 'error', 'messageContainer');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Check for quick action parameters in URL
    checkQuickActionParams();
    
    // Login is now handled by unified auth system
    console.log('📝 Admin.js loaded - authentication handled by unified system');

    // Refresh buttons
    document.getElementById('refreshBtn').addEventListener('click', loadApplications);
    document.getElementById('refreshEventsBtn').addEventListener('click', loadEvents);
    document.getElementById('refreshVenuesBtn').addEventListener('click', loadVenues);
    
    // Recovery button
    document.getElementById('recoverBtn').addEventListener('click', async () => {
        if (!confirm('⚠️ RECOVER DATA\n\nThis will attempt to rebuild the applications list from individual member records.\n\nThis is safe to run and will not delete any data.\n\nProceed?')) {
            return;
        }
        
        const recoverBtn = document.getElementById('recoverBtn');
        const originalText = recoverBtn.textContent;
        recoverBtn.textContent = '🔄 Recovering...';
        recoverBtn.disabled = true;
        
        try {
            const response = await fetch('/.netlify/functions/recover-applications-list', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                showMessage(`✅ Recovery successful! Recovered ${result.recovered} members. Status: ${JSON.stringify(result.statusBreakdown)}`, 'success');
                // Refresh the applications list
                setTimeout(() => {
                    loadApplications();
                }, 1000);
            } else {
                showError(`❌ Recovery failed: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Recovery error:', error);
            showError('❌ Recovery failed due to network error');
        } finally {
            recoverBtn.textContent = originalText;
            recoverBtn.disabled = false;
        }
    });

    // Venue form submission
    document.getElementById('venueForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const venueData = {
            name: formData.get('venueName').trim(),
            address: formData.get('venueAddress').trim(),
            phone: formData.get('venuePhone').trim(),
            website: formData.get('venueWebsite').trim(),
            notes: formData.get('venueNotes').trim(),
            drivingTips: formData.get('venueDrivingTips').trim(),
            vimeoId: formData.get('venueVimeoId').trim()
        };
        
        // Handle track map upload
        const trackMapFile = formData.get('venueTrackMap');
        if (trackMapFile && trackMapFile.size > 0) {
            const reader = new FileReader();
            const trackMapData = await new Promise((resolve, reject) => {
                reader.onload = e => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(trackMapFile);
            });
            venueData.trackMap = {
                data: trackMapData,
                fileName: trackMapFile.name,
                fileType: trackMapFile.type
            };
        }
        if (!venueData.name || !venueData.address) {
            showError('Please fill in all required fields', 'venuesMessageContainer');
            return;
        }
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;
        try {
            let response;
            if (editingVenueId) {
                response = await fetch('/.netlify/functions/update-venue', {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ venueId: editingVenueId, ...venueData })
                });
            } else {
                response = await fetch('/.netlify/functions/create-venue', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(venueData)
                });
            }
            const result = await response.json();
            if (response.ok && result.success) {
                showMessage(result.message, 'success', 'venuesMessageContainer');
                closeVenueModal();
                loadVenues();
                loadVenuesForDropdown();
            } else {
                showError(result.error || 'Failed to save venue', 'venuesMessageContainer');
            }
        } catch (error) {
            console.error('Error saving venue:', error);
            showError('Failed to save venue. Please try again.', 'venuesMessageContainer');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Track map preview functionality
    document.getElementById('venueTrackMap').addEventListener('change', function(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('trackMapPreview');
        const image = document.getElementById('trackMapImage');
        
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                image.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            preview.style.display = 'none';
        }
    });

    // Vimeo video preview functionality
    document.getElementById('venueVimeoId').addEventListener('input', function(e) {
        const vimeoId = e.target.value.trim();
        const preview = document.getElementById('vimeoPreview');
        const iframe = preview.querySelector('iframe');
        
        if (vimeoId && /^\d+$/.test(vimeoId)) {
            iframe.src = `https://player.vimeo.com/video/${vimeoId}`;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
            iframe.src = '';
        }
    });

    // Seed venues button
    document.getElementById('seedVenuesBtn').addEventListener('click', async function() {
        if (!confirm('This will add default venues if none exist. Continue?')) return;
        const btn = this;
        const originalText = btn.textContent;
        btn.textContent = 'Seeding...';
        btn.disabled = true;
        try {
            const response = await fetch('/.netlify/functions/seed-venues', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            if (response.ok) {
                showMessage(result.message, 'success', 'venuesMessageContainer');
                if (result.success) { loadVenues(); loadVenuesForDropdown(); }
            } else {
                showError(result.error || 'Failed to seed venues', 'venuesMessageContainer');
            }
        } catch (error) {
            console.error('Error seeding venues:', error);
            showError('Failed to seed venues. Please try again.', 'venuesMessageContainer');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    // Event venue selection
    document.getElementById('eventVenue').addEventListener('change', function() {
        if (this.value === 'add-new') {
            openAddVenueModal();
            this.value = '';
        }
    });

    // Event form submission
    document.getElementById('eventForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const selectedVenueId = formData.get('eventVenue');
        if (!selectedVenueId) {
            showError('Please select a venue', 'eventsMessageContainer');
            return;
        }
        const selectedVenue = venues.find(v => v.id === selectedVenueId);
        const eventData = {
            name: formData.get('eventName'),
            date: formData.get('eventDate'),
            time: formData.get('eventTime'),
            venueId: selectedVenueId,
            venue: selectedVenue ? selectedVenue.name : '',
            venueAddress: selectedVenue ? selectedVenue.address : '',
            maxAttendees: formData.get('eventMaxAttendees'),
            description: formData.get('eventDescription'),
            sendAnnouncement: formData.get('sendAnnouncement') === 'on'
        };
        
        // Show confirmation modal instead of creating event directly
        await showEventConfirmationModal(eventData);
    });

    // Edit event form submission
    document.getElementById('editEventForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const eventId = formData.get('editEventId');
        const selectedVenueId = formData.get('editEventVenue');
        
        if (!selectedVenueId) {
            showError('Please select a venue', 'eventsMessageContainer');
            return;
        }
        
        const selectedVenue = venues.find(v => v.id === selectedVenueId);
        const updates = {
            name: formData.get('editEventName'),
            date: formData.get('editEventDate'),
            time: formData.get('editEventTime'),
            venueId: selectedVenueId,
            venue: selectedVenue ? selectedVenue.name : '',
            venueAddress: selectedVenue ? selectedVenue.address : '',
            maxAttendees: formData.get('editEventMaxAttendees'),
            status: formData.get('editEventStatus'),
            description: formData.get('editEventDescription')
        };
        
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Updating...';
        submitBtn.disabled = true;
        
        try {
            const response = await fetch('/.netlify/functions/update-event', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, updates })
            });
            
            const result = await response.json();
            if (response.ok && result.success) {
                showMessage('Event updated successfully!', 'success', 'eventsMessageContainer');
                closeEventModal();
                loadEvents();
            } else {
                showError(result.error || 'Failed to update event', 'eventsMessageContainer');
            }
        } catch (error) {
            console.error('Event update error:', error);
            showError('Failed to update event. Please try again.', 'eventsMessageContainer');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Applicant form submission handler
    document.getElementById('applicantForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const applicantData = {
            applicationId: formData.get('applicantId'),
            firstName: formData.get('applicantFirstName').trim(),
            lastName: formData.get('applicantLastName').trim(),
            email: formData.get('applicantEmail').trim(),
            company: formData.get('applicantCompany').trim(),
            position: formData.get('applicantPosition').trim(),
            phone: formData.get('applicantPhone').trim(),
            linkedin: parseLinkedInProfile(formData.get('applicantLinkedin')),
            status: formData.get('applicantStatus'),
            isAdmin: document.getElementById('applicantIsAdmin').checked
        };
        
        if (!applicantData.firstName || !applicantData.lastName || !applicantData.email) {
            showMessage('First name, last name, and email are required.', 'error', 'applicantMessage');
            return;
        }
        
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;
        
        try {
            const success = await updateApplicantDetails(applicantData);
            if (success) {
                setTimeout(() => {
                    closeApplicantModal();
                }, 2000);
            }
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Event confirmation modal button handler
    document.getElementById('confirmCreateEventBtn').addEventListener('click', async function() {
        await confirmAndCreateEvent();
    });

    // Send test email button handler
    document.getElementById('sendTestEmailBtn').addEventListener('click', async function() {
        await sendTestEmail();
    });

    // Modal close on outside click
    window.onclick = function(event) {
        const venueModal = document.getElementById('venueModal');
        const eventModal = document.getElementById('eventModal');
        const applicantModal = document.getElementById('applicantModal');
        const eventConfirmationModal = document.getElementById('eventConfirmationModal');
        if (event.target === venueModal) closeVenueModal();
        if (event.target === eventModal) closeEventModal();
        if (event.target === applicantModal) closeApplicantModal();
        if (event.target === eventConfirmationModal) closeEventConfirmationModal();
    }

    // Video upload functionality
    const videoUpload = document.getElementById('videoUpload');
    const videoTitle = document.getElementById('videoTitle');
    const videoDescription = document.getElementById('videoDescription');
    const videoPreview = document.getElementById('videoPreview');
    const uploadVideoBtn = document.getElementById('uploadVideoBtn');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');

    // Video file selection handler
    videoUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) {
            videoPreview.style.display = 'none';
            uploadVideoBtn.disabled = true;
            return;
        }

        // Validate file size (500MB limit)
        const maxSize = 500 * 1024 * 1024; // 500MB in bytes
        if (file.size > maxSize) {
            alert('File size must be less than 500MB');
            videoUpload.value = '';
            videoPreview.style.display = 'none';
            uploadVideoBtn.disabled = true;
            return;
        }

        // Validate file type
        const validTypes = ['video/mp4', 'video/mov', 'video/quicktime', 'video/avi'];
        if (!validTypes.includes(file.type)) {
            alert('Please select a valid video file (MP4, MOV, AVI)');
            videoUpload.value = '';
            videoPreview.style.display = 'none';
            uploadVideoBtn.disabled = true;
            return;
        }

        // Show video preview
        const url = URL.createObjectURL(file);
        videoPreview.src = url;
        videoPreview.style.display = 'block';
        
        // Enable upload button
        uploadVideoBtn.disabled = false;
        
        // Set default title if not provided
        if (!videoTitle.value) {
            videoTitle.value = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        }
    });

    // Video upload button handler
    uploadVideoBtn.addEventListener('click', async function() {
        const file = videoUpload.files[0];
        if (!file) return;

        const eventId = document.getElementById('editEventId').value;
        if (!eventId) {
            alert('Please save the event first before uploading videos');
            return;
        }

        const title = videoTitle.value.trim() || file.name;
        const description = videoDescription.value.trim();

        // Show progress
        uploadProgress.style.display = 'block';
        uploadVideoBtn.disabled = true;
        uploadVideoBtn.textContent = 'Uploading...';
        progressBar.style.width = '10%';

        try {
            // Convert file to base64
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            progressBar.style.width = '30%';

            // Upload to Vimeo via our backend function
            const response = await fetch('/.netlify/functions/upload-video-vimeo', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    eventId: eventId,
                    videoData: base64Data,
                    fileName: file.name,
                    title: title,
                    description: description
                })
            });

            progressBar.style.width = '80%';

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            const result = await response.json();
            progressBar.style.width = '100%';

            if (result.success) {
                showMessage('Video uploaded to Vimeo successfully!', 'success', 'eventsMessageContainer');
                
                // Clear form
                videoUpload.value = '';
                videoTitle.value = '';
                videoDescription.value = '';
                videoPreview.style.display = 'none';
                
                // Refresh videos display
                loadEventVideos(eventId);
                
                // Refresh events list to show updated video count
                loadEvents();
            } else {
                throw new Error(result.error || 'Upload failed');
            }

        } catch (error) {
            console.error('Video upload error:', error);
            showError(`Video upload failed: ${error.message}`, 'eventsMessageContainer');
        } finally {
            uploadProgress.style.display = 'none';
            uploadVideoBtn.disabled = false;
            uploadVideoBtn.textContent = 'Upload to Vimeo';
            progressBar.style.width = '0%';
        }
    });

    // checkAuth() is now handled by unified authentication system
    console.log('🔧 Admin.js loaded, waiting for unified auth...');
});

// Load approved members for attendee selection
async function loadApprovedMembers() {
    try {
        const response = await fetch('/.netlify/functions/get-applications', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const approvedMembers = data.applications.filter(app => app.status === 'approved');
            populateMemberSelect(approvedMembers);
            return approvedMembers;
        }
    } catch (error) {
        console.error('Error loading approved members:', error);
    }
    return [];
}

function populateMemberSelect(members) {
    const select = document.getElementById('memberSelect');
    // Clear existing options except the first one
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }
    
    // Add member options
    members.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        const memberName = member.fullName || `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.name || 'Unknown';
        option.textContent = `${memberName} (${member.company || 'No company'})`;
        option.dataset.email = member.email;
        option.dataset.company = member.company || '';
        select.appendChild(option);
    });
}

// Enable/disable add attendee button based on selection
document.getElementById('memberSelect').addEventListener('change', function() {
    const addBtn = document.getElementById('addAttendeeBtn');
    addBtn.disabled = !this.value;
});

// Add attendee to event
document.getElementById('addAttendeeBtn').addEventListener('click', function() {
    const select = document.getElementById('memberSelect');
    const selectedOption = select.options[select.selectedIndex];
    
    if (!selectedOption.value) return;
    
    const eventId = document.getElementById('editEventId').value;
    const memberId = selectedOption.value;
    const memberName = selectedOption.textContent.split(' (')[0]; // Remove company part
    const memberEmail = selectedOption.dataset.email;
    const memberCompany = selectedOption.dataset.company;
    
    // Check if member is already added
    const event = events.find(e => e.id === eventId);
    const existingAttendee = event.attendees?.find(a => a.memberId === memberId);
    
    if (existingAttendee) {
        showError('This member is already added to the event', 'eventsMessageContainer');
        return;
    }
    
    // Add attendee to event
    addAttendeeToEvent(eventId, {
        memberId: memberId,
        name: memberName,
        email: memberEmail,
        company: memberCompany,
        registeredAt: new Date().toISOString(),
        attended: false
    });
    
    // Reset selection
    select.value = '';
    document.getElementById('addAttendeeBtn').disabled = true;
});

// Add attendee to event data and update display
async function addAttendeeToEvent(eventId, attendee) {
    try {
        // Find the event in our local events array
        const eventIndex = events.findIndex(e => e.id === eventId);
        if (eventIndex === -1) return;
        
        // Initialize attendees array if it doesn't exist
        if (!events[eventIndex].attendees) {
            events[eventIndex].attendees = [];
        }
        
        // Add the attendee
        events[eventIndex].attendees.push(attendee);
        
        // Update the event on the server
        await updateEventAttendees(eventId, events[eventIndex].attendees);
        
        // Refresh the attendees display
        displayEventAttendees(events[eventIndex].attendees);
        
        showMessage('Attendee added successfully!', 'success', 'eventsMessageContainer');
        
    } catch (error) {
        console.error('Error adding attendee:', error);
        showError('Failed to add attendee. Please try again.', 'eventsMessageContainer');
    }
}

// Remove attendee from event
async function removeAttendeeFromEvent(eventId, memberId) {
    try {
        const eventIndex = events.findIndex(e => e.id === eventId);
        if (eventIndex === -1) return;
        
        // Remove the attendee
        events[eventIndex].attendees = events[eventIndex].attendees.filter(a => a.memberId !== memberId);
        
        // Update the event on the server
        await updateEventAttendees(eventId, events[eventIndex].attendees);
        
        // Refresh the attendees display
        displayEventAttendees(events[eventIndex].attendees);
        
        showMessage('Attendee removed successfully!', 'success', 'eventsMessageContainer');
        
    } catch (error) {
        console.error('Error removing attendee:', error);
        showError('Failed to remove attendee. Please try again.', 'eventsMessageContainer');
    }
}

// Toggle attendee attendance status
async function toggleAttendeeStatus(eventId, memberId) {
    try {
        const eventIndex = events.findIndex(e => e.id === eventId);
        if (eventIndex === -1) return;
        
        const attendee = events[eventIndex].attendees.find(a => a.memberId === memberId);
        if (!attendee) return;
        
        // Toggle attendance status
        attendee.attended = !attendee.attended;
        attendee.statusUpdatedAt = new Date().toISOString();
        
        // Update the event on the server
        await updateEventAttendees(eventId, events[eventIndex].attendees);
        
        // Refresh the attendees display
        displayEventAttendees(events[eventIndex].attendees);
        
    } catch (error) {
        console.error('Error updating attendee status:', error);
        showError('Failed to update attendance status. Please try again.', 'eventsMessageContainer');
    }
}

// Update event attendees on server
async function updateEventAttendees(eventId, attendees) {
    const response = await fetch('/.netlify/functions/update-event', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            eventId: eventId,
            updates: {
                attendees: attendees
            }
        })
    });
    
    if (!response.ok) {
        throw new Error('Failed to update event attendees');
    }
    
    return await response.json();
}

// Display event attendees
function displayEventAttendees(attendees) {
    const attendeesList = document.getElementById('attendeesList');
    
    if (!attendees || attendees.length === 0) {
        attendeesList.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No attendees added yet</p>';
        updateAttendeeStats(0, 0, 0);
        return;
    }
    
    const attendedCount = attendees.filter(a => a.attended).length;
    const noShowCount = attendees.filter(a => !a.attended).length;
    
    updateAttendeeStats(attendees.length, attendedCount, noShowCount);
    
    const attendeesHTML = attendees.map(attendee => `
        <div class="attendee-item">
            <div class="attendee-info">
                <div class="attendee-name">${attendee.name}</div>
                <div class="attendee-details">
                    ${attendee.company ? `${attendee.company} • ` : ''}${attendee.email}
                    <br><small>Registered: ${new Date(attendee.registeredAt).toLocaleDateString()}</small>
                </div>
            </div>
            <div class="attendee-status">
                <span style="font-size: 0.8rem; margin-right: 8px;">
                    ${attendee.attended ? 'Attended' : 'Registered'}
                </span>
                <div class="status-toggle ${attendee.attended ? 'attended' : ''}" 
                    onclick="toggleAttendeeStatus('${document.getElementById('editEventId').value}', '${attendee.memberId}')">
                </div>
                <button class="remove-attendee" 
                        onclick="removeAttendeeFromEvent('${document.getElementById('editEventId').value}', '${attendee.memberId}')">
                    Remove
                </button>
            </div>
        </div>
    `).join('');
    
    attendeesList.innerHTML = attendeesHTML;
}

// Update attendee statistics
function updateAttendeeStats(registered, attended, noShow) {
    document.getElementById('registeredCount').textContent = registered;
    document.getElementById('attendedCount').textContent = attended;
    document.getElementById('noShowCount').textContent = noShow;
}

// Load event attendees when opening edit modal
async function loadEventAttendees(eventId) {
    const event = events.find(e => e.id === eventId);
    if (event && event.attendees) {
        displayEventAttendees(event.attendees);
    } else {
        displayEventAttendees([]);
    }
}

// Note: loadEventVideos function is defined earlier in the file (line 701)

// Note: displayEventVideos function is defined earlier in the file (line 722)

// Global functions for onclick handlers
window.switchTab = switchTab;
window.openAddVenueModal = openAddVenueModal;
window.closeVenueModal = closeVenueModal;
window.editVenue = editVenue;
window.deleteVenue = deleteVenue;
window.filterVenues = filterVenues;
window.updateApplication = updateApplication;
window.deleteApplication = deleteApplication;
window.showDetails = showDetails;
window.editEvent = editEvent;
window.closeEventModal = closeEventModal;
window.deleteEvent = deleteEvent;
window.loadEventPhotos = loadEventPhotos;
window.displayEventPhotos = displayEventPhotos;
window.loadEventVideos = loadEventVideos;
window.displayEventVideos = displayEventVideos;
window.addAttendeeToEvent = addAttendeeToEvent;
window.removeAttendeeFromEvent = removeAttendeeFromEvent;
window.toggleAttendeeStatus = toggleAttendeeStatus;
window.loadEventAttendees = loadEventAttendees;
window.loadApprovedMembers = loadApprovedMembers;

// CMS Functions
let selectedGalleryPhotos = [];
let allEventPhotos = [];
let currentFaqs = [];

async function loadGalleryManagement() {
    try {
        console.log('Loading gallery management...');
        
        // Load existing gallery selection
        try {
            const response = await fetch('/.netlify/functions/get-gallery', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            console.log('Get gallery response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Gallery data received:', data);
                selectedGalleryPhotos = data.photos || [];
                updateGalleryStats();
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.log('Gallery fetch error:', errorData);
                // Don't fail here, just start with empty selection
                selectedGalleryPhotos = [];
            }
        } catch (galleryError) {
            console.error('Error fetching gallery:', galleryError);
            selectedGalleryPhotos = [];
        }
        
        // Load available photos from events
        try {
            await loadAvailablePhotos();
            console.log('Available photos loaded, count:', allEventPhotos.length);
        } catch (photosError) {
            console.error('Error loading available photos:', photosError);
            allEventPhotos = [];
        }
        
        renderGalleryManagement();
        console.log('Gallery management loaded successfully');
        
    } catch (error) {
        console.error('Error in loadGalleryManagement:', error);
        showError(`Failed to load gallery management: ${error.message}`, 'galleryMessageContainer');
    }
}

async function loadAvailablePhotos() {
    try {
        console.log('Loading available photos from events...');
        const response = await fetch('/.netlify/functions/get-events', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        console.log('Get events response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Events data received:', data);
            const events = data.events || [];
            allEventPhotos = [];
            
            events.forEach(event => {
                if (event.photos && event.photos.length > 0) {
                    console.log(`Event "${event.name}" has ${event.photos.length} photos`);
                    event.photos.forEach(photo => {
                        allEventPhotos.push({
                            ...photo,
                            eventName: event.name,
                            eventDate: event.date
                        });
                    });
                }
            });
            
            console.log(`Total photos collected: ${allEventPhotos.length}`);
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Events fetch error:', errorData);
            throw new Error(`Failed to fetch events: ${errorData.error || response.status}`);
        }
    } catch (error) {
        console.error('Error loading available photos:', error);
        throw error; // Re-throw to be caught by parent function
    }
}

function renderGalleryManagement() {
    const availableGrid = document.getElementById('availablePhotosGrid');
    const selectedGrid = document.getElementById('selectedPhotosGrid');
    
    console.log('Rendering gallery management. Available photos:', allEventPhotos.length, 'Selected photos:', selectedGalleryPhotos.length);
    
    if (allEventPhotos.length === 0) {
        availableGrid.innerHTML = '<p style="color: #7f8c8d; text-align: center; grid-column: 1 / -1;">No event photos available. Upload photos to events first.</p>';
    } else {
        availableGrid.innerHTML = allEventPhotos.map(photo => {
            const photoUrl = photo.url || photo.src || `/.netlify/functions/get-photo?path=${encodeURIComponent(photo.path)}`;
            return `
            <div class="photo-item" style="position: relative; cursor: pointer; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); ${selectedGalleryPhotos.find(p => p.id === photo.id) ? 'opacity: 0.5;' : ''}" 
                 onclick="selectPhoto('${photo.id}')">
                <img src="${photoUrl}" alt="${photo.caption || 'Event photo'}" style="width: 100%; height: 120px; object-fit: cover;">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.8)); color: white; padding: 8px 6px 6px; font-size: 0.7rem;">
                    <div style="font-weight: 600;">${photo.eventName}</div>
                    <div style="opacity: 0.8;">${photo.eventDate}</div>
                </div>
                ${selectedGalleryPhotos.find(p => p.id === photo.id) ? '<div style="position: absolute; top: 5px; right: 5px; background: #27ae60; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">✓</div>' : ''}
            </div>
            `;
        }).join('');
    }
    
    if (selectedGalleryPhotos.length === 0) {
        selectedGrid.innerHTML = '<p style="color: #7f8c8d; text-align: center; grid-column: 1 / -1;">Click photos from the left to add them here</p>';
    } else {
        selectedGrid.innerHTML = selectedGalleryPhotos.map(photo => {
            const photoUrl = photo.url || photo.src || `/.netlify/functions/get-photo?path=${encodeURIComponent(photo.path)}`;
            return `
            <div class="photo-item" style="position: relative; cursor: pointer; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" 
                 onclick="deselectPhoto('${photo.id}')">
                <img src="${photoUrl}" alt="${photo.caption || 'Event photo'}" style="width: 100%; height: 100px; object-fit: cover;">
                <div style="position: absolute; top: 2px; right: 2px; background: #e74c3c; color: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; cursor: pointer;">×</div>
            </div>
            `;
        }).join('');
    }
    
    document.getElementById('selectedCount').textContent = selectedGalleryPhotos.length;
}

function selectPhoto(photoId) {
    if (selectedGalleryPhotos.length >= 12) {
        showError('Maximum 12 photos allowed in gallery', 'galleryMessageContainer');
        return;
    }
    
    const photo = allEventPhotos.find(p => p.id === photoId);
    if (photo && !selectedGalleryPhotos.find(p => p.id === photoId)) {
        selectedGalleryPhotos.push(photo);
        renderGalleryManagement();
    }
}

function deselectPhoto(photoId) {
    selectedGalleryPhotos = selectedGalleryPhotos.filter(p => p.id !== photoId);
    renderGalleryManagement();
}

async function saveGallerySelection() {
    try {
        console.log('Saving gallery selection:', selectedGalleryPhotos);
        
        // Prepare photos with proper URL structure for frontend
        const photosForFrontend = selectedGalleryPhotos.map(photo => ({
            id: photo.id,
            url: photo.url || photo.src || `/.netlify/functions/get-photo?path=${encodeURIComponent(photo.path)}`,
            alt: photo.alt || photo.caption || `Photo from ${photo.eventName}`,
            caption: photo.caption || `Photo from ${photo.eventName}`,
            eventName: photo.eventName,
            eventDate: photo.eventDate,
            uploadedAt: photo.uploadedAt
        }));

        console.log('Photos prepared for frontend:', photosForFrontend);

        const response = await fetch('/.netlify/functions/update-gallery', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ photos: photosForFrontend })
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('Success response:', result);
            showMessage('Gallery updated successfully!', 'success', 'galleryMessageContainer');
            updateGalleryStats();
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Error response:', errorData);
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
    } catch (error) {
        console.error('Error saving gallery:', error);
        showError(`Failed to save gallery: ${error.message}`, 'galleryMessageContainer');
    }
}

async function loadFaqs() {
    try {
        const response = await fetch('/.netlify/functions/get-faqs', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            const data = await response.json();
            currentFaqs = data.faqs || [];
            updateFaqStats();
            renderFaqs();
        }
    } catch (error) {
        console.error('Error loading FAQs:', error);
        showError('Failed to load FAQs. Please try again.', 'faqMessageContainer');
    }
}

function renderFaqs() {
    const container = document.getElementById('faqContainer');
    
    if (currentFaqs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No FAQs found</h3>
                <p>Start by adding your first FAQ to help visitors understand The Kartel better.</p>
                <button class="btn btn-success" onclick="openAddFaqModal()">Add Your First FAQ</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = currentFaqs.map(faq => `
        <div class="faq-item" style="background: white; border: 1px solid #ecf0f1; border-radius: 8px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <h4 style="color: #2c3e50; font-weight: 600; margin: 0; flex: 1;">${faq.question}</h4>
                <div style="display: flex; gap: 10px; margin-left: 15px;">
                    <button class="btn btn-secondary btn-small" onclick="editFaq('${faq.id}')">Edit</button>
                    <button class="btn btn-danger btn-small" onclick="deleteFaq('${faq.id}')">Delete</button>
                </div>
            </div>
            <p style="color: #5d6d7e; margin: 0; line-height: 1.5;">${faq.answer}</p>
            <small style="color: #95a5a6; display: block; margin-top: 10px;">Order: ${faq.order || 'Not set'}</small>
        </div>
    `).join('');
}

function openAddFaqModal() {
    document.getElementById('faqModalTitle').textContent = 'Add FAQ';
    document.getElementById('faqId').value = '';
    document.getElementById('faqQuestion').value = '';
    document.getElementById('faqAnswer').value = '';
    document.getElementById('faqOrder').value = '';
    document.getElementById('faqModal').style.display = 'block';
}

function editFaq(faqId) {
    const faq = currentFaqs.find(f => f.id === faqId);
    if (faq) {
        document.getElementById('faqModalTitle').textContent = 'Edit FAQ';
        document.getElementById('faqId').value = faq.id;
        document.getElementById('faqQuestion').value = faq.question;
        document.getElementById('faqAnswer').value = faq.answer;
        document.getElementById('faqOrder').value = faq.order || '';
        document.getElementById('faqModal').style.display = 'block';
    }
}

function closeFaqModal() {
    document.getElementById('faqModal').style.display = 'none';
}

async function deleteFaq(faqId) {
    if (!confirm('Are you sure you want to delete this FAQ?')) return;
    
    try {
        const response = await fetch('/.netlify/functions/delete-faq', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ id: faqId })
        });
        
        if (response.ok) {
            showMessage('FAQ deleted successfully!', 'success', 'faqMessageContainer');
            loadFaqs();
        } else {
            throw new Error('Failed to delete FAQ');
        }
    } catch (error) {
        console.error('Error deleting FAQ:', error);
        showError('Failed to delete FAQ. Please try again.', 'faqMessageContainer');
    }
}

async function seedFaqs() {
    if (!confirm('This will populate the CMS with the existing FAQs from the website. Continue?')) return;
    
    try {
        const response = await fetch('/.netlify/functions/seed-faqs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            showMessage(result.message, 'success', 'faqMessageContainer');
            loadFaqs();
        } else {
            throw new Error('Failed to seed FAQs');
        }
    } catch (error) {
        console.error('Error seeding FAQs:', error);
        showError('Failed to seed FAQs. Please try again.', 'faqMessageContainer');
    }
}

async function loadExperienceVideo() {
    try {
        const response = await fetch('/.netlify/functions/get-experience-video', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            const data = await response.json();
            const videoId = data.vimeoId || '1092055210';
            document.getElementById('experienceVimeoId').value = videoId;
            updateVideoPreview(videoId);
            updateVideoStats(videoId);
        }
    } catch (error) {
        console.error('Error loading experience video:', error);
        showError('Failed to load experience video. Please try again.', 'videoMessageContainer');
    }
}

function updateVideoPreview(vimeoId) {
    const preview = document.getElementById('experienceVideoPreview');
    if (vimeoId && vimeoId.trim()) {
        preview.innerHTML = `
            <iframe src="https://player.vimeo.com/video/${vimeoId}" 
                    width="100%" height="100%" frameborder="0" 
                    allow="autoplay; fullscreen; picture-in-picture" 
                    allowfullscreen></iframe>
        `;
    } else {
        preview.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #7f8c8d;">No video selected</div>';
    }
}

async function updateExperienceVideo() {
    const vimeoId = document.getElementById('experienceVimeoId').value.trim();
    
    if (!vimeoId) {
        showError('Please enter a Vimeo video ID', 'videoMessageContainer');
        return;
    }
    
    try {
        const response = await fetch('/.netlify/functions/update-experience-video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ vimeoId })
        });
        
        if (response.ok) {
            showMessage('Experience video updated successfully!', 'success', 'videoMessageContainer');
            updateVideoPreview(vimeoId);
            updateVideoStats(vimeoId);
        } else {
            throw new Error('Failed to update experience video');
        }
    } catch (error) {
        console.error('Error updating experience video:', error);
        showError('Failed to update experience video. Please try again.', 'videoMessageContainer');
    }
}

function updateGalleryStats() {
    document.getElementById('totalGalleryPhotos').textContent = selectedGalleryPhotos.length;
}

function updateFaqStats() {
    document.getElementById('totalFaqs').textContent = currentFaqs.length;
}

function updateVideoStats(videoId) {
    document.getElementById('experienceVideoId').textContent = videoId || '-';
    document.getElementById('contentLastUpdated').textContent = new Date().toLocaleDateString();
}

// Event listeners for CMS
document.getElementById('faqForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const faqData = {
        id: formData.get('faqId') || Date.now().toString(),
        question: formData.get('faqQuestion'),
        answer: formData.get('faqAnswer'),
        order: parseInt(formData.get('faqOrder')) || currentFaqs.length + 1
    };
    
    try {
        const response = await fetch('/.netlify/functions/update-faq', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(faqData)
        });
        
        if (response.ok) {
            showMessage('FAQ saved successfully!', 'success', 'faqMessageContainer');
            closeFaqModal();
            loadFaqs();
        } else {
            throw new Error('Failed to save FAQ');
        }
    } catch (error) {
        console.error('Error saving FAQ:', error);
        showError('Failed to save FAQ. Please try again.', 'faqMessage');
    }
});

// Input listener for video preview
document.getElementById('experienceVimeoId').addEventListener('input', (e) => {
    const vimeoId = e.target.value.trim();
    updateVideoPreview(vimeoId);
});

// Event Confirmation Modal Functions
let pendingEventData = null;

async function showEventConfirmationModal(eventData) {
    pendingEventData = eventData;
    
    // Populate the confirmation modal with event details
    document.getElementById('confirmEventName').textContent = eventData.name || 'Not specified';
    document.getElementById('confirmEventDate').textContent = eventData.date ? new Date(eventData.date).toLocaleDateString() : 'Not specified';
    document.getElementById('confirmEventTime').textContent = eventData.time || 'Not specified';
    document.getElementById('confirmEventVenue').textContent = eventData.venue || 'Not specified';
    document.getElementById('confirmEventMaxAttendees').textContent = eventData.maxAttendees || 'No limit';
    document.getElementById('confirmEventDescription').textContent = eventData.description || 'No description';
    
    // Handle announcement info
    const announcementInfo = document.getElementById('announcementInfo');
    const confirmButtonText = document.getElementById('confirmButtonText');
    
    if (eventData.sendAnnouncement) {
        announcementInfo.style.display = 'block';
        confirmButtonText.textContent = 'Confirm & Send';
        
        // Load approved member count
        try {
            const approvedMembers = await loadApprovedMembersCount();
            document.getElementById('approvedMemberCount').textContent = approvedMembers;
        } catch (error) {
            console.error('Error loading approved members count:', error);
            document.getElementById('approvedMemberCount').textContent = 'Unknown';
        }
    } else {
        announcementInfo.style.display = 'none';
        confirmButtonText.textContent = 'Confirm & Create Event';
    }
    
    // Show the modal
    document.getElementById('eventConfirmationModal').style.display = 'block';
}

function closeEventConfirmationModal() {
    document.getElementById('eventConfirmationModal').style.display = 'none';
    pendingEventData = null;
}

async function confirmAndCreateEvent() {
    if (!pendingEventData) {
        showError('No event data found', 'eventsMessageContainer');
        return;
    }
    
    const confirmBtn = document.getElementById('confirmCreateEventBtn');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = 'Creating...';
    confirmBtn.disabled = true;
    
    try {
        const response = await fetch('/.netlify/functions/create-event', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(pendingEventData)
        });
        const result = await response.json();
        
        if (response.ok && result.success) {
            closeEventConfirmationModal();
            showMessage('Event created successfully!', 'success', 'eventsMessageContainer');
            document.getElementById('eventForm').reset();
            loadEvents();
        } else {
            showError(result.error || 'Failed to create event', 'eventsMessageContainer');
        }
    } catch (error) {
        console.error('Event creation error:', error);
        showError('Failed to create event. Please try again.', 'eventsMessageContainer');
    } finally {
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
    }
}

async function loadApprovedMembersCount() {
    try {
        const response = await fetch('/.netlify/functions/get-applications', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const approvedMembers = data.applications.filter(app => app.status === 'approved');
            return approvedMembers.length;
        }
        return 0;
    } catch (error) {
        console.error('Error loading approved members:', error);
        return 0;
    }
}

async function loadModalMemberCount() {
    try {
        const approvedMembers = await loadApprovedMembersCount();
        document.getElementById('modalApprovedMemberCount').textContent = approvedMembers;
    } catch (error) {
        console.error('Error loading member count for modal:', error);
        document.getElementById('modalApprovedMemberCount').textContent = 'Unknown';
    }
}

function setupEmailButtons(eventId) {
    // Remove existing event listeners to avoid duplicates
    const announceBtn = document.getElementById('sendAnnouncementEmailBtn');
    const reminderBtn = document.getElementById('sendReminderEmailBtn');
    const testBtn = document.getElementById('modalSendTestEmailBtn');
    
    // Clone buttons to remove all event listeners
    const newAnnounceBtn = announceBtn.cloneNode(true);
    const newReminderBtn = reminderBtn.cloneNode(true);
    const newTestBtn = testBtn.cloneNode(true);
    
    announceBtn.parentNode.replaceChild(newAnnounceBtn, announceBtn);
    reminderBtn.parentNode.replaceChild(newReminderBtn, reminderBtn);
    testBtn.parentNode.replaceChild(newTestBtn, testBtn);
    
    // Add new event listeners
    newAnnounceBtn.addEventListener('click', async function() {
        await sendEventAnnouncementFromModal(eventId);
    });
    
    newReminderBtn.addEventListener('click', async function() {
        await sendReminderFromModal(eventId);
    });
    
    newTestBtn.addEventListener('click', async function() {
        await sendTestEmailFromModal(eventId);
    });
}

async function sendEventAnnouncementFromModal(eventId) {
    const event = events.find(e => e.id === eventId);
    if (!event) {
        showError('Event not found', 'eventModalMessageContainer');
        return;
    }
    
    const confirmMessage = `Send announcement email to all approved members about "${event.name}" on ${new Date(event.date).toLocaleDateString()}?`;
    if (!confirm(confirmMessage)) return;
    
    const btn = document.getElementById('sendAnnouncementEmailBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/.netlify/functions/send-event-announcement', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                eventId: eventId,
                eventName: event.name,
                eventDate: event.date,
                eventTime: event.time,
                eventVenue: event.venue,
                eventDescription: event.description
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            showMessage(`Announcement sent successfully! ${result.emailsSent} emails sent.`, 'success', 'eventModalMessageContainer');
        } else {
            const error = await response.json();
            showError(`Failed to send announcement: ${error.error}`, 'eventModalMessageContainer');
        }
    } catch (error) {
        console.error('Error sending announcement:', error);
        showError('An error occurred while sending the announcement', 'eventModalMessageContainer');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function sendReminderFromModal(eventId) {
    const event = events.find(e => e.id === eventId);
    if (!event) {
        showError('Event not found', 'eventModalMessageContainer');
        return;
    }
    
    const confirmMessage = `Send reminder email to all approved members about "${event.name}" on ${new Date(event.date).toLocaleDateString()}?`;
    if (!confirm(confirmMessage)) return;
    
    const btn = document.getElementById('sendReminderEmailBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/.netlify/functions/send-event-announcement', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                eventId: eventId,
                eventName: event.name,
                eventDate: event.date,
                eventTime: event.time,
                eventVenue: event.venue,
                eventDescription: event.description,
                isReminder: true
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            showMessage(`Reminder sent successfully! ${result.stats.sent} emails sent.`, 'success', 'eventModalMessageContainer');
        } else {
            const error = await response.json();
            showError(`Failed to send reminder: ${error.error}`, 'eventModalMessageContainer');
        }
    } catch (error) {
        console.error('Error sending reminder:', error);
        showError('An error occurred while sending the reminder', 'eventModalMessageContainer');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function sendTestEmailFromModal(eventId) {
    const event = events.find(e => e.id === eventId);
    if (!event) {
        showError('Event not found', 'eventsMessageContainer');
        return;
    }

    // Get admin's email - first try to get from stored user data, then prompt
    let adminEmail = null;
    
    // Try to get from stored user data
    try {
        const storedUser = localStorage.getItem('kartel_admin_user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            adminEmail = user.email;
        }
    } catch (error) {
        console.error('Error getting stored user data:', error);
    }

    // If no stored email, prompt for it
    if (!adminEmail) {
        adminEmail = prompt('Enter your email address for the test email:');
        if (!adminEmail) {
            return; // User cancelled
        }
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(adminEmail)) {
            showError('Please enter a valid email address', 'eventsMessageContainer');
            return;
        }
    }

    // Get the selected test email type
    const testEmailType = document.getElementById('testEmailType');
    const isReminderTest = testEmailType ? testEmailType.value === 'reminder' : false;

    const testBtn = document.getElementById('modalSendTestEmailBtn');
    const originalText = testBtn.textContent;
    testBtn.textContent = 'Sending...';
    testBtn.disabled = true;

    try {
        const response = await fetch('/.netlify/functions/send-test-email', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                eventId: eventId,
                adminEmail: adminEmail,
                eventData: event,
                isReminder: isReminderTest
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            const emailType = isReminderTest ? 'reminder' : 'announcement';
            showMessage(`Test ${emailType} email sent successfully to ${adminEmail}!`, 'success', 'eventModalMessageContainer');
        } else {
            showError(`Failed to send test email: ${result.error}`, 'eventModalMessageContainer');
        }
    } catch (error) {
        console.error('Error sending test email:', error);
        showError('An error occurred while sending the test email', 'eventModalMessageContainer');
    } finally {
        testBtn.textContent = originalText;
        testBtn.disabled = false;
    }
}

async function sendTestEmail() {
    if (!pendingEventData) {
        showError('No event data found', 'eventsMessageContainer');
        return;
    }

    // Get admin's email - first try to get from stored user data, then prompt
    let adminEmail = null;
    
    // Try to get from stored user data
    try {
        const storedUser = localStorage.getItem('kartel_admin_user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            adminEmail = user.email;
        }
    } catch (error) {
        console.error('Error getting stored user data:', error);
    }

    // If no stored email, prompt for it
    if (!adminEmail) {
        adminEmail = prompt('Enter your email address for the test email:');
        if (!adminEmail) {
            return; // User cancelled
        }
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(adminEmail)) {
            showError('Please enter a valid email address', 'eventsMessageContainer');
            return;
        }
    }

    const testBtn = document.getElementById('sendTestEmailBtn');
    const originalText = testBtn.textContent;
    testBtn.textContent = 'Sending...';
    testBtn.disabled = true;

    try {
        // Create a temporary event to get an ID for the test
        const testEventData = {
            ...pendingEventData,
            id: `test-${Date.now()}`, // Temporary ID for test
            createdAt: new Date().toISOString()
        };

        const response = await fetch('/.netlify/functions/send-test-email', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                eventId: testEventData.id,
                adminEmail: adminEmail,
                eventData: testEventData
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showMessage(`Test email sent successfully to ${adminEmail}!`, 'success', 'eventsMessageContainer');
        } else {
            showError(result.error || 'Failed to send test email', 'eventsMessageContainer');
        }
    } catch (error) {
        console.error('Test email error:', error);
        showError('Failed to send test email. Please try again.', 'eventsMessageContainer');
    } finally {
        testBtn.textContent = originalText;
        testBtn.disabled = false;
    }
}

// Make CMS functions globally available
window.loadGalleryManagement = loadGalleryManagement;
window.selectPhoto = selectPhoto;
window.deselectPhoto = deselectPhoto;
window.saveGallerySelection = saveGallerySelection;
window.loadFaqs = loadFaqs;
window.openAddFaqModal = openAddFaqModal;
window.editFaq = editFaq;
window.closeFaqModal = closeFaqModal;
window.deleteFaq = deleteFaq;
window.seedFaqs = seedFaqs;
window.loadExperienceVideo = loadExperienceVideo;
window.updateExperienceVideo = updateExperienceVideo;
window.closeApplicantModal = closeApplicantModal;
window.closeEventConfirmationModal = closeEventConfirmationModal;

// Switch to member view function
function switchToMemberView() {
    const adminUser = localStorage.getItem('kartel_admin_user');
    
    if (adminUser) {
        try {
            const user = JSON.parse(adminUser);
            console.log('👨‍💼 Switching to member view for admin:', user.email);
            
            // Store a marker that we switched from admin
            sessionStorage.setItem('switched_from_admin', 'true');
            
            // Navigate to members area
            window.location.href = '/members.html';
        } catch (error) {
            console.error('Error parsing admin user data:', error);
            // Fallback - just navigate to members
            window.location.href = '/members.html';
        }
    } else {
        window.location.href = '/members.html';
    }
}

window.switchToMemberView = switchToMemberView;

// Export functions needed by inline admin.html scripts
window.showDashboard = showDashboard;
window.loadApplications = loadApplications;
window.loadVenuesForDropdown = loadVenuesForDropdown;