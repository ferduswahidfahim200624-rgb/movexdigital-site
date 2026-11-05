(function(){
  var y=document.getElementById('mx-footer-year'); if(y) y.textContent=new Date().getFullYear();
  var form=document.getElementById('mx-footer-newsletter'); if(!form) return;
  form.addEventListener('submit',function(e){
    e.preventDefault(); var input=form.querySelector('input[type="email"]'); if(!input||!input.checkValidity()){if(input) input.reportValidity(); return;}
    var subject=encodeURIComponent('MoveX Media newsletter request');
    var body=encodeURIComponent('Please add me to MoveX Media updates.\n\nEmail: '+input.value+'\n\nI understand this request is sent by email.');
    window.location.href='mailto:ferdouswahidfahim24@gmail.com?subject='+subject+'&body='+body;
  });
})();
