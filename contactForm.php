<?php

// SETUP 
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// FILE DEPENDENCIES
require 'phpmailer/src/Exception.php';
require 'phpmailer/src/PHPMailer.php';
require 'phpmailer/src/SMTP.php';

if (isset($_POST['submit'])) {

    // Initializing PHPMailer
    $mail = new PHPMailer(true);
    //Server settings
    $mail->SMTPDebug = 2;                                       // Enable verbose debug output
    $mail->isSMTP(true);                                            // Set mailer to use SMTP
    $mail->Host       = 'smtp.gmail.com';  // Specify main and backup SMTP servers
    $mail->SMTPAuth   = true;                                   // Enable SMTP authentication
    $mail->Username   = 'morganvbusiness@gmail.com';                     // SMTP username
    $mail->Password   = 'shovel3006';                               // SMTP password
    $mail->SMTPSecure = 'tls';                                  // Enable TLS encryption, `ssl` also accepted
    $mail->Port       = 587;                                    // TCP port to connect to

    //Recipients
    $mail->setFrom('morganvbusiness@gmail.com', 'Mailer');
    $mail->addAddress('morganvanv@gmail.com', 'Morgan Van V');     // Add a recipient
    $mail->addReplyTo($_POST['mail'], $_POST['name']);

    //Content
    $mail->isHTML(true);    
    $mail->Subject = $_POST['subject'];
    $mail->Body = $_POST['message'];

    try {
        $mail->send();
        echo 'Your message was sent successfully!';
    } catch (Exception $e) {
        echo "Your message could not be sent! PHPMailer Error: {$mail->ErrorInfo}";
    }
    
} else {
    echo "There is a problem with the contact.html document!";
}




/*    
    $name = $_POST['name'];                     // Gathering Form Inputs
    $subject = $_POST['subject'];
    $mailFrom = $_POST['mail'];
    $message = $_POST['message'];

    $mailTo = "morganvbusiness@gmail.com";           // Designating address and layout of the email
    $headers = "From: ".$mailFrom;
    $txt = "You have recieved an e-mail from ".$name.".\n\n".$message;

    mail($mailTo, $subject, $txt, $headers);
    header("Location: index.php?mailsend");

}

*/ 