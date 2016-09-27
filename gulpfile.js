var gulp = require('gulp')
var path = require('path')
var less = require('gulp-less')
var autoprefixer = require('gulp-autoprefixer')
var sourcemaps = require('gulp-sourcemaps')
var minifyCSS = require('gulp-minify-css')
var rename = require('gulp-rename')
var concat = require('gulp-concat')
var uglify = require('gulp-uglify')
var connect = require('gulp-connect')
var open = require('gulp-open')

var Paths = {
  HERE: './',
  DIST: 'dist',
  DIST_TOOLKIT_JS: 'dist/toolkit.js',
  LESS_TOOLKIT_SOURCES: './less/toolkit*',
  LESS: './less/**/**',
  JS: [
    './js/jquery.min.js',
    './js/odometer.min.js',
    './js/highlight.pack.js',
    './js/bootstrap.min.js',
    './js/jqBootstrapValidation.js',
    './js/d3.v4.min.js',
    //'./js/jquery.fullpage.min.js',
    './js/typed.js',
    './js/custom/*',
    './js/application.js',
  ]
}

gulp.task('default', ['js-min', 'less-min', 'server', 'watch'])

gulp.task('watch', function () {
  gulp.watch(Paths.JS, ['js-min']);
  gulp.watch(Paths.LESS, ['less-min']);
})

gulp.task('docs', ['server'], function () {
  gulp.src(__filename)
    .pipe(open({
      uri: 'http://localhost:9000/docs/'
    }))
})

gulp.task('server', function () {
  connect.server({
    root: '.',
    port: 9000,
    livereload: true
  });

  gulp.src(__filename)
    .pipe(open({
      uri: 'http://localhost:9000/'
    }));
})

gulp.task('less', function () {
  return gulp.src(Paths.LESS_TOOLKIT_SOURCES)
    .pipe(sourcemaps.init())
    .pipe(less())
    .pipe(autoprefixer())
    .pipe(sourcemaps.write(Paths.HERE))
    .pipe(gulp.dest('dist'))
})

gulp.task('less-min', ['less'], function () {
  return gulp.src(Paths.LESS_TOOLKIT_SOURCES)
    .pipe(sourcemaps.init())
    .pipe(less())
    .pipe(minifyCSS())
    .pipe(autoprefixer())
    .pipe(rename({
      suffix: '.min'
    }))
    .pipe(sourcemaps.write(Paths.HERE))
    .pipe(gulp.dest(Paths.DIST))
})

gulp.task('js', function () {
  console.log("Running js!");
  return gulp.src(Paths.JS)
    .pipe(concat('toolkit.js'))
    .pipe(gulp.dest(Paths.DIST))
})

gulp.task('js-min', ['js'], function () {
  return gulp.src(Paths.DIST_TOOLKIT_JS)
    .pipe(uglify())
    .pipe(rename({
      suffix: '.min'
    }))
    .pipe(gulp.dest(Paths.DIST))
})
