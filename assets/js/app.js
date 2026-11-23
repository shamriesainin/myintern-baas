document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 1. LOAD HTML COMPONENTS DYNAMICALLY ---
    // Since we are not using PHP, we use fetch() to inject the HTML components
    const loadComponent = async (url, targetId) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const html = await response.text();
            document.getElementById(targetId).innerHTML = html;
        } catch (error) {
            console.error(`Error loading component ${url}:`, error);
        }
    };

    // Load components sequentially to ensure DOM is ready before attaching events
    await loadComponent('components/view-form.html', 'component-form');
    await loadComponent('components/view-company-list.html', 'component-list');


    // --- 2. INITIALIZE SUPABASE CLIENT ---
    // Students must replace these with their own Supabase project credentials
    const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
    const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
    
    // Only initialize if keys are present (prevents crash if student forgets)
    let supabase = null;
    if (SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL') {
         supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        document.getElementById('company-list').innerHTML = '<p class="text-red-500 font-bold p-4 bg-red-100 rounded border border-red-400">Please add your Supabase URL and Key in app.js!</p>';
        return; // Stop execution
    }

    const showToast = (message) => {
        const toast = document.getElementById('toast');
        toast.querySelector('span').textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    };

    // --- 3. READ DATA ---
    const loadCompanies = async () => {
        try {
            const { data: companies, error } = await supabase
                .from('companies')
                .select('*')
                .order('choice_number', { ascending: true });

            if (error) throw error;

            const listDiv = document.getElementById('company-list');
            
            if (!companies || companies.length === 0) {
                listDiv.innerHTML = '<p class="text-gray-600 italic text-sm">No companies added yet.</p>';
                return;
            }

            let html = '';
            companies.forEach(company => {
                const companyData = encodeURIComponent(JSON.stringify(company));
                const statusColor = company.supervisor_approval === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-200 text-gray-800';
                
                html += `
                <div class="bg-white border border-gray-200 rounded shadow-sm flex flex-col sm:flex-row overflow-hidden hover:bg-gray-50 transition">
                    <div class="bg-blue-100 text-blue-800 w-full sm:w-12 flex items-center justify-center font-bold text-lg border-b sm:border-b-0 sm:border-r border-gray-200 py-1 sm:py-0">
                        ${company.choice_number}
                    </div>
                    <div class="p-2.5 flex-1 text-sm">
                        <div class="font-bold text-base text-gray-900 leading-tight">
                            ${company.company_name} 
                            <span class="text-xs font-normal text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded ml-1 align-middle">${company.company_nature}</span>
                        </div>
                        <div class="mt-1 text-gray-700 leading-snug"><span class="font-semibold">Core Business:</span> ${company.core_business}</div>
                        <div class="text-gray-700 leading-snug"><span class="font-semibold">Address:</span> ${company.company_address}</div>
                        <div class="mt-1.5 flex items-center gap-2">
                            <span class="font-semibold text-gray-700 text-xs">Approval:</span> 
                            <span class="px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${statusColor}">
                                ${company.supervisor_approval}
                            </span>
                        </div>
                    </div>
                    <div class="bg-gray-100 border-t sm:border-t-0 sm:border-l border-gray-200 p-2 flex sm:flex-col justify-center gap-1.5 min-w-[80px]">
                        <button onclick="editCompany('${companyData}')" type="button" class="bg-blue-500 text-white text-center w-full px-2 py-1 rounded text-xs font-bold hover:bg-blue-600 transition">Edit</button>
                        <button onclick="deleteCompany(${company.id})" type="button" class="bg-red-500 text-white w-full px-2 py-1 rounded text-xs font-bold hover:bg-red-600 transition">Delete</button>
                    </div>
                </div>`;
            });
            listDiv.innerHTML = html;
        } catch (error) {
            console.error("Error loading data:", error);
            document.getElementById('company-list').innerHTML = `<p class="text-red-500 text-sm">Error connecting to Supabase: ${error.message}</p>`;
        }
    };

    // --- 4. CREATE & UPDATE ---
    // Must re-query the DOM because we injected the form HTML dynamically
    const formElement = document.getElementById('company-form');
    
    if (formElement) {
        formElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const editId = document.getElementById('edit-id').value;
            const formData = {
                company_name: document.getElementById('company_name').value,
                company_nature: document.querySelector('input[name="company_nature"]:checked').value,
                company_address: document.getElementById('company_address').value,
                core_business: document.getElementById('core_business').value,
                supervisor_approval: document.getElementById('supervisor_approval').value
            };

            try {
                // Disable button during submit
                const btnSubmit = document.getElementById('btn-submit');
                const originalText = btnSubmit.textContent;
                btnSubmit.textContent = 'Saving...';
                btnSubmit.disabled = true;

                if (editId) {
                    const { error } = await supabase
                        .from('companies')
                        .update(formData)
                        .eq('id', editId);
                    
                    if (error) throw error;
                    showToast("Company choice updated successfully!");
                } else {
                    const { data: maxChoiceData, error: maxError } = await supabase
                        .from('companies')
                        .select('choice_number')
                        .order('choice_number', { ascending: false })
                        .limit(1);
                    
                    if (maxError) throw maxError;
                    
                    const nextNumber = (maxChoiceData && maxChoiceData.length > 0) ? maxChoiceData[0].choice_number + 1 : 1;
                    formData.choice_number = nextNumber;

                    const { error } = await supabase
                        .from('companies')
                        .insert([formData]);
                    
                    if (error) throw error;
                    showToast("New company choice added successfully!");
                }
                
                resetForm();
                loadCompanies();
            } catch (error) {
                console.error("Error saving data:", error);
                alert("Error saving data to Supabase.");
            } finally {
                // Restore button state
                const btnSubmit = document.getElementById('btn-submit');
                btnSubmit.textContent = document.getElementById('edit-id').value ? 'Update Choice' : 'Add New Choice';
                btnSubmit.disabled = false;
            }
        });
    }

    // --- 5. PREPARE UI FOR EDITING ---
    window.editCompany = (encodedData) => {
        const company = JSON.parse(decodeURIComponent(encodedData));
        
        document.getElementById('edit-id').value = company.id;
        document.getElementById('company_name').value = company.company_name;
        document.getElementById('company_address').value = company.company_address;
        document.getElementById('core_business').value = company.core_business;
        document.getElementById('supervisor_approval').value = company.supervisor_approval;
        document.querySelector(`input[name="company_nature"][value="${company.company_nature}"]`).checked = true;
        
        const approvalRadios = document.querySelectorAll('input[name="display_supervisor_approval"]');
        approvalRadios.forEach(radio => { radio.checked = (radio.value === company.supervisor_approval); });

        // Update UI colors to Yellow
        document.getElementById('form-container').className = "bg-white mb-6 border-2 border-yellow-500 rounded-lg shadow-sm overflow-hidden text-sm transition-colors duration-300";
        document.getElementById('form-header-div').className = "bg-yellow-100 px-4 py-2 font-bold flex justify-between items-center text-base transition-colors duration-300";
        document.getElementById('form-icon').className = "bg-yellow-500 text-white rounded-full w-7 h-7 flex items-center justify-center mr-3 transition-colors duration-300";
        document.getElementById('form-icon').textContent = company.choice_number;
        document.getElementById('form-title').textContent = 'Edit Company Choice';
        document.getElementById('btn-cancel').classList.remove('hidden');
        document.getElementById('btn-submit').textContent = 'Update Choice';
        document.getElementById('btn-submit').className = "bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1.5 px-6 rounded transition text-sm";
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Fix: Attach cancel event after form is injected
    const btnCancel = document.getElementById('btn-cancel');
    if (btnCancel) {
        btnCancel.addEventListener('click', (e) => {
            e.preventDefault();
            resetForm(); 
        });
    }

    const resetForm = () => {
        document.getElementById('company-form').reset();
        document.getElementById('edit-id').value = '';
        document.getElementById('supervisor_approval').value = 'Pending';
        document.querySelector('input[name="display_supervisor_approval"][value="Pending"]').checked = true;

        // Revert UI colors to Blue
        document.getElementById('form-container').className = "bg-white mb-6 border-2 border-dashed border-blue-600 rounded-lg shadow-sm overflow-hidden text-sm transition-colors duration-300";
        document.getElementById('form-header-div').className = "bg-gray-100 px-4 py-2 font-bold flex justify-between items-center text-base transition-colors duration-300";
        document.getElementById('form-icon').className = "bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-3 transition-colors duration-300";
        document.getElementById('form-icon').textContent = '+';
        document.getElementById('form-title').textContent = 'Add New Company';
        document.getElementById('btn-cancel').classList.add('hidden');
        document.getElementById('btn-submit').textContent = 'Add New Choice';
        document.getElementById('btn-submit').className = "bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-6 rounded transition text-sm";
    };

    // --- 6. DELETE & RE-SEQUENCE ---
    window.deleteCompany = async (id) => {
        if (confirm('Delete this choice?')) {
            try {
                const { error: deleteError } = await supabase
                    .from('companies')
                    .delete()
                    .eq('id', id);
                
                if (deleteError) throw deleteError;

                const { data: remaining, error: fetchError } = await supabase
                    .from('companies')
                    .select('id')
                    .order('choice_number', { ascending: true });
                
                if (fetchError) throw fetchError;

                for (let i = 0; i < remaining.length; i++) {
                    await supabase
                        .from('companies')
                        .update({ choice_number: i + 1 })
                        .eq('id', remaining[i].id);
                }

                showToast("Company choice deleted successfully!");
                loadCompanies();
            } catch (error) {
                console.error("Error deleting data:", error);
                alert("Error deleting data from Supabase.");
            }
        }
    };

    // Kickoff
    loadCompanies();
});
