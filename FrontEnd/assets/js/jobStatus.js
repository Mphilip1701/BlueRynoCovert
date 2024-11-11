document.addEventListener('DOMContentLoaded', function() {
    const jobStatusForm = document.getElementById('jobStatusForm');
    const jobInfo = document.getElementById('jobInfo');
    const paymentSection = document.getElementById('paymentSection');

    jobStatusForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const referenceNumber = document.getElementById('referenceNumber').value;
        const email = document.getElementById('email').value;

        try {
            const response = await fetch('/api/jobStatus/status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ referenceNumber, email })
            });

            if (!response.ok) {
                throw new Error('Job not found');
            }

            const { success, data } = await response.json();
            
            if (!success) {
                throw new Error('Failed to fetch job status');
            }

            // Update job information
            document.getElementById('customerName').textContent = data.CustomerName;
            document.getElementById('jobAddress').textContent = data.JobAddress;
            document.getElementById('materialType').textContent = data.MaterialType;
            document.getElementById('fenceLength').textContent = `${data.FenceLength} meters`;
            document.getElementById('jobStatus').textContent = data.CurrentStatus;

            // Show/hide payment information if applicable
            if (data.PaymentStatus) {
                document.getElementById('paymentStatus').textContent = data.PaymentStatus;
                paymentSection.style.display = 'block';

                // Show payment link if payment is pending and link exists
                if (data.PaymentStatus === 'pending' && data.PaymentLink) {
                    const paymentLinkContainer = document.getElementById('paymentLinkContainer');
                    paymentLinkContainer.innerHTML = `
                        <a href="${data.PaymentLink}" class="button icon solid fa-credit-card" target="_blank">
                            Make Payment
                        </a>
                    `;
                }
            } else {
                paymentSection.style.display = 'none';
            }

            // Show the job information section
            jobInfo.style.display = 'block';

        } catch (error) {
            console.error('Error:', error);
            alert('Could not find job with the provided reference number and email. Please check your information and try again.');
            jobInfo.style.display = 'none';
        }
    });
});