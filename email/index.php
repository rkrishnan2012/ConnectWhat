<?php
// Since Bootstrap is only a front-end framework, we need to 
// introduce added functionality in order for to make the 
// contact form functional.  We’re going to be creating a 
// working Bootstrap contact form with PHP here.  
// Our contact form will also have built-in spam prevention 
// and form validation.

error_reporting(-1);
ini_set('display_errors', 'On');

require('Mandrill.php');

$name = $_POST['name'];
$email = $_POST['email'];
$message = nl2br('<br>'.$_POST['message']);
$phone = $_POST['phone'];
// $human = intval($_POST['human']);
$from = $email; 
$to = 'hello@hivelabs.it'; 
$subject = 'Contact request from '."$name";
$mandrill = new Mandrill('tSr4sEhLhO2aYaq_6PlcmQ');
$template_name = 'ContactForm';
$message = array(
    'subject' => 'Hive Contact Form',
    'from_email' => 'automonkey@hivelabs.it',
    'from_name' => 'Auto Monkey',
    'to' => array(
        array(
            'email' => 'hello@hivelabs.it',
            'name' => 'Info',
            'type' => 'to'
        ),
        array(
          'email' => 'rkrishnan@hivelabs.it',
          'name' => 'Rohit Krishnan',
        ),
        array(
          'email' => 'klim@hivelabs.it',
          'name' => 'Khyteang Lim',
        )
    ),
    'headers' => array('Reply-To' => 'hello@hivelabs.it'),
    'important' => false,
    'track_opens' => null,
    'track_clicks' => null,
    'auto_text' => null,
    'auto_html' => null,
    'inline_css' => true,
    'url_strip_qs' => null,
    'preserve_recipients' => null,
    'view_content_link' => null,
    'tracking_domain' => null,
    'signing_domain' => null,
    'return_path_domain' => null,
    'merge' => true,
    'merge_language' => 'mailchimp',
    'global_merge_vars' => array(
        array(
            'name' => 'FULL_NAME',
            'content' => $name
        ),
        array(
            'name' => 'EMAIL',
            'content' => $email
        ),
        array(
            'name' => 'PHONE',
            'content' => $phone
        ),
        array(
            'name' => 'USER_MESSAGE',
            'content' => $message
        )
    ),
);
$async = false;
$ip_pool = 'Main Pool';
$send_at = '';
$result = $mandrill->messages->sendTemplate($template_name, $template_content, $message, $async, $ip_pool, $send_at);
print_r($result);
?>
