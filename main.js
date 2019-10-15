$(document).ready(function() {

    /* HIDING ELEMENTS */
    $('.skillsContent').hide();
    $('.experienceContent').hide();
    $('.experienceWindow').hide();
    $('.experienceDescription').hide();
    $('.jInstruct').hide();
    $('.edContent').hide();
    $('.ecContent').hide();

    /* INITIALIZATION STATEMENT */
    console.log( "We are ready for launch, Captain!" );

    /* SKILLS */
    $('#skillsButton').on('click', () => {
        $('.skillsContent').slideToggle(500);
    })

    /* EXPERIENCE */
    $('#experienceButton').on('click', () => {
        $('.experienceContent').slideToggle(500);
        $('.jInstruct').slideToggle(500);
    })

    $('#experienceButton').on('click', () => {
        $('.experienceWindow').slideToggle(500);
    })

    /* JOB DESCRIPTION INTERACTIVITY */
    $('.experienceContent').on('mouseenter', () => {
        $('.jInstruct').hide();
    }).on('mouseleave', () => {
        $('.jInstruct').fadeIn(500);
    });

    $('#jTitle1').on('mouseenter', () => {
        $('#jDesc1').fadeIn(500);
    }).on('mouseleave', () => {
        $('#jDesc1').hide();
    });

    $('#jTitle2').on('mouseenter', () => {
        $('#jDesc2').fadeIn(500);
    }).on('mouseleave', () => {
        $('#jDesc2').hide();
    });

    $('#jTitle3').on('mouseenter', () => {
        $('#jDesc3').fadeIn(500);
    }).on('mouseleave', () => {
        $('#jDesc3').hide();
    });

    $('#jTitle4').on('mouseenter', () => {
        $('#jDesc4').fadeIn(500);
    }).on('mouseleave', () => {
        $('#jDesc4').hide();
    });

    /* EDUCATION */
    $('#edButton').on('click', () => {
        $('.edContent').slideToggle(500);
    })

    /* EXTRA CIRRICULARS */
    $('#ecButton').on('click', () => {
        $('.ecContent').slideToggle(500);
    })

});