document.addEventListener('DOMContentLoaded', function() {
    const quoteForm = document.getElementById('quoteForm');
    const photoPreview = document.getElementById('photoPreview');
    
    // Photo preview functionality
    document.getElementById('photos').addEventListener('change', function(e) {
        photoPreview.innerHTML = ''; // Clear existing previews
        
        for (let file of this.files) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    photoPreview.appendChild(img);
                }
                reader.readAsDataURL(file);
            }
        }
    });

    // Phone number formatting
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', function(e) {
        let cleaned = e.target.value.replace(/\D/g, '');
        if (cleaned.length > 10) cleaned = cleaned.substr(0, 10);
        if (cleaned.length >= 6) {
            cleaned = cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
        } else if (cleaned.length >= 3) {
            cleaned = cleaned.replace(/(\d{3})(\d{0,3})/, '($1) $2');
        }
        e.target.value = cleaned;
    });

    // Form submission
    quoteForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            // Show loading state
            const submitButton = quoteForm.querySelector('input[type="submit"]');
            const originalButtonText = submitButton.value;
            submitButton.value = 'Sending...';
            submitButton.disabled = true;

            // Create FormData object
            const formData = new FormData(quoteForm);

            // Handle file uploads
            const photoFiles = document.getElementById('photos').files;
            formData.delete('photos'); // Remove the original files input
            for (let i = 0; i < photoFiles.length; i++) {
                formData.append('photos', photoFiles[i]);
            }

            // Convert FormData to JSON for most fields
            const formJSON = {};
            formData.forEach((value, key) => {
                if (key !== 'photos') {
                    formJSON[key] = value;
                }
            });

            // Create the final payload
            const payload = new FormData();
            payload.append('data', JSON.stringify(formJSON));
            // Append photos separately
            for (let i = 0; i < photoFiles.length; i++) {
                payload.append('photos', photoFiles[i]);
            }

            // Send the form data to the backend
            const response = await fetch('/api/quotes', {
                method: 'POST',
                body: payload
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message || 'Failed to submit quote request');
            }

            const result = await response.json();

            // Show success message with reference number
            alert(`Quote request submitted successfully! Your reference number is: ${result.referenceNumber}\n\nPlease save this number for checking your quote status later. You will also receive a confirmation email shortly.`);
            quoteForm.reset();
            photoPreview.innerHTML = ''; // Clear photo previews

        } catch (error) {
            console.error('Error:', error);
            alert('There was an error submitting your quote request. Please try again.');
        } finally {
            // Get the button again in case it wasn't found earlier
    const submitButton = quoteForm.querySelector('input[type="submit"]');
    if (submitButton) {
        submitButton.value = originalButtonText || 'Submit';
        submitButton.disabled = false;
        }
    };

    // Form reset handler
    quoteForm.addEventListener('reset', function() {
        photoPreview.innerHTML = ''; // Clear photo previews
    });
})});
