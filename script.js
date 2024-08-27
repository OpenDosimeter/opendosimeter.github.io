function showDataLog() {
    const iframe = document.getElementById('dataLogIFrame'); 
    const overview = document.getElementById('overview');
    const community = document.getElementById('community'); 
    const getInvolved = document.getElementById('getInvolved');
    
    if (window.location.hash === '#dataLog') {
        iframe.style.display = 'block'; 
    } else {
        iframe.style.display = 'none';
    }

    if (window.location.hash === '#overview' || window.location.hash === '') {
        overview.style.display = 'block'; 
    } else {
        overview.style.display = 'none'; 
    }

    if (window.location.hash === '#community') {
        community.style.display = 'block'; 
    } else {
        community.style.display = 'none'; 
    }
    if (window.location.hash === '#getInvolved') {
        getInvolved.style.display = 'block'; 
    } else {
        getInvolved.style.display = 'none'; 
    }

    setTimeout(() => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }, 0);
}

showDataLog(); 

window.addEventListener('hashchange', showDataLog);


document.addEventListener('DOMContentLoaded', () => {
    const menuIcon = document.getElementById('menu-icon'); 
    const navBar = document.getElementsByClassName('navbar')[0]; 
    const navLinks = navBar.getElementsByTagName('a'); 

    menuIcon.addEventListener('click', () => { 
        console.log(navBar.classList); 
        navBar.classList.toggle('active'); 
    });
    Array.from(navLinks).forEach(link => {
        link.addEventListener('click', () => {
            // Only toggle active navbar if in compact view
            if (window.innerWidth <= 1155) {
                navBar.classList.remove('active'); 
            }
        })
    })
})