<?php
// download.php

if (!isset($_GET['file'])) {
    http_response_code(400);
    echo "No file specified.";
    exit;
}

$files = [
    'research1' => 'AI_Enhanced_Predictive_Safety_Framework.pdf',
    'research2' => 'AI_Driven_Disaster_Prediction_Drone_Swarm.pdf',
];

$key = $_GET['file'];

if (!isset($files[$key])) {
    http_response_code(404);
    echo "File not found.";
    exit;
}

$filename = $files[$key];
$filepath = __DIR__ . '/docs/' . $filename; // Make sure PDFs are inside 'docs/' folder

if (!file_exists($filepath)) {
    http_response_code(404);
    echo "File not found on server.";
    exit;
}

// Force download
header('Content-Description: File Transfer');
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . basename($filename) . '"');
header('Expires: 0');
header('Cache-Control: must-revalidate');
header('Pragma: public');
header('Content-Length: ' . filesize($filepath));
readfile($filepath);
exit;
